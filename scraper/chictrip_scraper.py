"""
去趣 chictrip.com.tw eSIM 爬蟲
執行: python scraper/chictrip_scraper.py
輸出: data/chictrip_plans.json（可貼入 dataset/esim_dataset_builder.py 的 PLANS_DB）
"""

import re
import os
import json
from playwright.sync_api import sync_playwright

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

# 所有已驗證的產品 code
PRODUCT_CODES = [
    ("日本",   ["japan/unlimited", "japan/daily-data"]),
    ("韓國",   ["korea/unlimited", "korea/daily-data"]),
    ("泰國",   ["thailand/unlimited"]),
    ("中港澳", ["china-hongkong-macau/unlimited", "china-hongkong-macau/daily-data"]),
    ("中國",   ["china/unlimited", "china/daily-data"]),
    ("新馬",   ["singapore-malaysia/unlimited", "singapore-malaysia/daily-data"]),
    ("越南",   ["vietnam/unlimited", "vietnam/daily-data"]),
    ("菲律賓", ["philippines/unlimited", "philippines/daily-data"]),
    ("歐洲",   ["europe/unlimited", "europe/daily-data"]),
    ("澳洲",   ["australia/unlimited", "australia/daily-data"]),
    ("日韓",   ["japan-korea/unlimited", "japan-korea/daily-data"]),
    ("亞洲",   ["asia/unlimited", "asia/daily-data"]),
]


def parse_sku(order_token: str, actual_price: float) -> dict | None:
    """
    解析 orderToken 取得天數與流量
    格式：WM-e-IIJ-10GB-10D / WM-e-TWM-500MB-1D / WM-e-J1-KR-MAX-10D
    """
    days_m = re.search(r'-(\d+)D$', order_token, re.IGNORECASE)
    if not days_m:
        return None

    days  = int(days_m.group(1))
    gb_m  = re.search(r'-([\d.]+)GB-', order_token, re.IGNORECASE)
    mb_m  = re.search(r'-([\d.]+)MB-', order_token, re.IGNORECASE)
    max_m = re.search(r'-MAX-', order_token, re.IGNORECASE)

    if gb_m:
        data_gb = float(gb_m.group(1))
    elif mb_m:
        data_gb = round(float(mb_m.group(1)) / 1024, 2)
    elif max_m:
        data_gb = 9999   # 吃到飽
    else:
        return None

    return {
        "days":        days,
        "data_gb":     data_gb,
        "price":       int(actual_price),
        "order_token": order_token,
    }


def fetch_product(browser, code: str) -> dict | None:
    """每次產生新 page，避免 session 污染，最多重試 2 次"""
    for attempt in range(2):
        result = {}
        page = browser.new_page()

        def on_resp(response):
            if "GetProduct" in response.url:
                try:
                    result["data"] = response.json()
                except Exception:
                    pass

        page.on("response", on_resp)
        try:
            page.goto(
                f"https://www.chictrip.com.tw/esim/{code}",
                wait_until="domcontentloaded",
                timeout=25000,
            )
            page.wait_for_timeout(3000)
        except Exception:
            pass
        finally:
            page.close()

        d = result.get("data", {})
        if d.get("apiStatus") == "001":
            return d.get("data")

    return None


def scrape() -> dict:
    plans_db = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for dest, codes in PRODUCT_CODES:
            dest_plans = []

            for code in codes:
                raw = fetch_product(browser, code)

                if not raw:
                    print(f"  SKIP {code}")
                    continue

                product_name = raw["name"]
                network = product_name.split("|")[-1].strip() if "|" in product_name else ""
                is_unlimited = "unlimited" in code

                for plan in raw.get("plans", []):
                    for sku in plan.get("skus", []):
                        if not sku.get("isActive"):
                            continue
                        parsed = parse_sku(sku["orderToken"], sku["actualPrice"])
                        if not parsed:
                            continue

                        note = "吃到飽" if is_unlimited else f"{parsed['data_gb']}GB/天"
                        dest_plans.append({
                            "provider": "去趣chictrip",
                            "name":     f"{product_name.split('|')[0].strip()} {parsed['days']}天",
                            "data_gb":  9999 if is_unlimited else parsed["data_gb"],
                            "daily_cap_gb": parsed["data_gb"] if is_unlimited else None,
                            "days":     parsed["days"],
                            "price":    parsed["price"],
                            "network":  network,
                            "note":     note,
                            "code":     code,
                        })

                print(f"  OK  {code} | {len(dest_plans)} 筆累計")

            if dest_plans:
                seen = set()
                unique = []
                for p in dest_plans:
                    key = (p["days"], p["data_gb"], p["price"])
                    if key not in seen:
                        seen.add(key)
                        unique.append(p)
                unique.sort(key=lambda x: (x["days"], x["price"]))
                plans_db[dest] = unique

        browser.close()

    return plans_db


def main():
    print("開始爬取去趣 eSIM 方案...\n")
    plans = scrape()

    total = sum(len(v) for v in plans.values())
    print(f"\n完成！共 {len(plans)} 個目的地，{total} 個 SKU\n")

    for dest, items in plans.items():
        print(f"{dest}: {len(items)} 個方案，最低 NT${min(i['price'] for i in items)}")

    os.makedirs(DATA_DIR, exist_ok=True)
    output = os.path.join(DATA_DIR, "chictrip_plans.json")
    with open(output, "w", encoding="utf-8") as f:
        json.dump(plans, f, ensure_ascii=False, indent=2)
    print(f"\n已儲存至 {output}")
    print("下一步：執行 python dataset/esim_dataset_builder.py")


if __name__ == "__main__":
    main()
