"""
eSIM 方案推薦 AI - 資料集建立腳本
執行: python dataset/esim_dataset_builder.py
輸出: dataset/alpaca_esim.json（可直接餵給 Unsloth 訓練）

資料來源優先級：
  1. data/chictrip_plans.json（由 scraper/chictrip_scraper.py 產生的真實資料）
  2. FALLBACK_PLANS_DB（內建備用資料）
"""

import json
import random
import os

DATA_DIR    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
DATASET_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────
# 備用資料庫（chictrip_plans.json 不存在時使用）
# ─────────────────────────────────────────
FALLBACK_PLANS_DB = {
    "日本": [
        {"provider": "去趣chictrip", "name": "日本eSIM 3天", "data_gb": 1,    "days": 3,  "price": 120, "network": "Softbank/Docomo", "note": "1GB/天"},
        {"provider": "去趣chictrip", "name": "日本eSIM 5天", "data_gb": 2,    "days": 5,  "price": 200, "network": "Softbank/Docomo", "note": "2GB/天"},
        {"provider": "去趣chictrip", "name": "日本eSIM 7天", "data_gb": 9999, "days": 7,  "price": 420, "network": "Softbank/Docomo", "note": "吃到飽"},
    ],
}


def load_plans_db() -> dict:
    """從 data/chictrip_plans.json 載入，失敗則用備用資料"""
    path = os.path.join(DATA_DIR, "chictrip_plans.json")
    try:
        with open(path, encoding="utf-8") as f:
            db = json.load(f)
        total = sum(len(v) for v in db.values())
        print(f"已載入 chictrip_plans.json：{len(db)} 個目的地，{total} 個方案")
        return db
    except FileNotFoundError:
        print("找不到 chictrip_plans.json，使用備用資料（建議先執行 scraper/chictrip_scraper.py）")
        return FALLBACK_PLANS_DB


PLANS_DB = load_plans_db()

USAGE_DAILY_GB = {
    "輕度（看地圖、傳訊）": 0.5,
    "中度（社群、導航）": 1.5,
    "重度（串流影片）": 3.5,
    "不限（吃到飽）": 9999,
}

INSTRUCTION_TEMPLATES = [
    "我要去{dest}，待{days}天，每天用量約{usage}，預算 NT${budget} 以內，推薦 eSIM 方案",
    "出發去{dest} {days}天，使用習慣是{usage}，最多花 NT${budget}，哪個 eSIM 比較好？",
    "{dest}旅遊 {days} 天，{usage}，預算 NT${budget}，eSIM 要怎麼選？",
    "下週要去{dest}待 {days} 天，{usage}，NT${budget} 預算，幫我推薦 eSIM",
    "規劃{dest}行程 {days} 天，習慣{usage}，預算大概 NT${budget}，eSIM 怎麼買比較划算？",
]

INSTRUCTION_NO_BUDGET = [
    "我要去{dest}，待{days}天，每天用量約{usage}，推薦 eSIM 方案",
    "去{dest} {days}天，使用習慣是{usage}，哪個 eSIM 最適合？",
    "{dest}旅遊 {days} 天，{usage}，eSIM 選哪個好？",
]


def plan_covers_usage(plan: dict, daily_gb: float) -> bool:
    if plan["data_gb"] == 9999:
        return True
    return plan["data_gb"] >= daily_gb


def find_plans(destination: str, days: int, daily_gb: float, budget: int | None) -> list[dict]:
    """根據條件篩選方案，回傳最多3個由好到差排序的方案"""
    if destination not in PLANS_DB:
        return []

    candidates = []
    for plan in PLANS_DB[destination]:
        if plan["days"] < days:
            continue
        if not plan_covers_usage(plan, daily_gb):
            continue
        if budget and plan["price"] > budget:
            continue
        candidates.append(plan)

    candidates.sort(key=lambda p: (p["data_gb"] == 9999, p["price"]))
    return candidates[:3]


def format_data_str(plan: dict) -> str:
    if plan["data_gb"] == 9999:
        cap = plan.get("daily_cap_gb")
        return f"吃到飽（每日{cap}GB）" if cap and cap < 9999 else "吃到飽"
    return f"{plan['data_gb']}GB/天"


def build_response(plans: list[dict], destination: str, days: int, daily_gb: float, budget: int | None) -> str:
    """生成自然語言推薦回覆"""
    if not plans:
        return (
            f"在您的條件下（{destination} {days}天，每天 {daily_gb}GB"
            + (f"，預算 NT${budget}" if budget else "")
            + "），目前資料庫中沒有完全符合的方案。"
            "建議放寬預算或考慮使用吃到飽方案，或縮短天數。"
        )

    lines = []

    if len(plans) == 1:
        p = plans[0]
        data_str = format_data_str(p)
        lines.append(f"推薦 **{p['name']}**（NT${p['price']}）。")
        lines.append(f"流量：{data_str}，效期 {p['days']} 天，使用 {p['network']} 網路。")
        lines.append(f"適合：{p['note']}。")
    else:
        lines.append("以下是符合條件的方案（由推薦到次選）：\n")
        for i, p in enumerate(plans, 1):
            tag = ["首選", "次選", "備選"][i - 1]
            data_str = format_data_str(p)
            lines.append(f"{i}. **{tag}：{p['name']}**")
            lines.append(f"   - 價格：NT${p['price']}")
            lines.append(f"   - 流量：{data_str} / {p['days']} 天")
            lines.append(f"   - 網路：{p['network']}")
            lines.append(f"   - 適合：{p['note']}")
        lines.append("\n建議選擇首選方案。")

    return "\n".join(lines)


def generate_samples() -> list[dict]:
    samples = []
    usage_options = list(USAGE_DAILY_GB.items())
    budget_multipliers = [1.0, 1.3, 1.8, None]

    for dest, dest_plans in PLANS_DB.items():
        if not dest_plans:
            continue

        available_days = sorted(set(p["days"] for p in dest_plans))
        day_options = [d for d in available_days if d <= 30][:8]

        for days in day_options:
            for usage_label, daily_gb in usage_options:
                for bm in budget_multipliers:
                    valid = [p for p in dest_plans
                             if p["days"] >= days and plan_covers_usage(p, daily_gb)]
                    if not valid:
                        continue
                    prices = sorted(p["price"] for p in valid)
                    base_price = prices[len(prices) // 2]
                    budget = int(base_price * bm) if bm else None

                    matched = find_plans(dest, days, daily_gb, budget)
                    response = build_response(matched, dest, days, daily_gb, budget)

                    if budget:
                        tmpl = random.choice(INSTRUCTION_TEMPLATES)
                        instruction = tmpl.format(dest=dest, days=days, usage=usage_label, budget=budget)
                    else:
                        tmpl = random.choice(INSTRUCTION_NO_BUDGET)
                        instruction = tmpl.format(dest=dest, days=days, usage=usage_label)

                    samples.append({"instruction": instruction, "input": "", "output": response})

    COMPARE_TMPL = (
        "去{dest} {days}天，吃到飽方案和每日流量方案哪個比較划算？用量{usage}",
        "每日流量方案按天計費，{usage}情況下每天只需 {daily_plan_name}（NT${daily_price}）；"
        "吃到飽方案則是 {unlim_name}（NT${unlim_price}），不需計算流量。"
        "{days}天總費用：每日流量約 NT${daily_total}，吃到飽 NT${unlim_price}。"
        "{rec}"
    )

    for dest, dest_plans in PLANS_DB.items():
        daily_plans   = [p for p in dest_plans if p["data_gb"] != 9999]
        unlim_plans   = [p for p in dest_plans if p["data_gb"] == 9999]
        if not daily_plans or not unlim_plans:
            continue

        for usage_label, daily_gb in usage_options[:3]:
            days = random.choice([3, 5, 7])
            d_valid = [p for p in daily_plans if p["days"] >= days and plan_covers_usage(p, daily_gb)]
            u_valid = [p for p in unlim_plans if p["days"] >= days]
            if not d_valid or not u_valid:
                continue

            d = min(d_valid, key=lambda p: p["price"])
            u = min(u_valid, key=lambda p: p["price"])
            daily_total = d["price"] * days // d["days"] if d["days"] > 0 else d["price"]
            rec = "若預算優先，選每日流量更省錢。" if daily_total < u["price"] else "若不想計算流量，選吃到飽更方便。"

            q = COMPARE_TMPL[0].format(dest=dest, days=days, usage=usage_label)
            a = COMPARE_TMPL[1].format(
                usage=usage_label,
                daily_plan_name=d["name"], daily_price=d["price"],
                unlim_name=u["name"],      unlim_price=u["price"],
                days=days, daily_total=daily_total, rec=rec,
            )
            samples.append({"instruction": q, "input": "", "output": a})

    random.shuffle(samples)
    return samples


def main():
    print("正在生成 eSIM 推薦資料集...")
    samples = generate_samples()
    print(f"共生成 {len(samples)} 筆訓練樣本")

    output_path = os.path.join(DATASET_DIR, "alpaca_esim.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(samples, f, ensure_ascii=False, indent=2)

    print(f"已輸出至 {output_path}")
    print("\n前 2 筆範例：")
    for s in samples[:2]:
        print(f"\n[instruction] {s['instruction']}")
        print(f"[output] {s['output'][:120]}...")


if __name__ == "__main__":
    main()
