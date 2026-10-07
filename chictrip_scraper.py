"""
去趣 chictrip.com.tw eSIM 爬蟲
執行: python chictrip_scraper.py
輸出: chictrip_plans.json（可貼入 esim_dataset_builder.py 的 PLANS_DB）
"""

import re
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from webapp.logging_setup import get_logger
from playwright.sync_api import sync_playwright

log = get_logger("scraper", "scraper.log")

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


VARIANT_KEYWORDS = ("標準", "高速", "鈦金")


def classify_variant(option_name: str) -> str | None:
    """從 specOption 名稱（例如「鈦金吃到飽」）判定 variant 類型。"""
    for kw in VARIANT_KEYWORDS:
        if kw in option_name:
            return kw
    return None


def build_sku_variant_map(plan: dict) -> dict[str, str | None]:
    """產生 skuId → variant（標準/高速/鈦金/None）的對應表。

    靠 planSpecs 找 DataVolume 類別下的 specOptionId → variant，
    再用 specOptionMappingSkus 把 skuId 對回去。
    """
    data_volume_options: dict[str, str] = {}
    for spec in plan.get("planSpecs", []):
        if spec.get("specName") != "DataVolume":
            continue
        for opt in spec.get("specOptions", []):
            variant = classify_variant(opt.get("optionName", ""))
            if variant:
                data_volume_options[opt["specOptionId"]] = variant

    sku_variant: dict[str, str | None] = {}
    for mapping in plan.get("specOptionMappingSkus", []):
        opt_id = mapping.get("specOptionId")
        if opt_id in data_volume_options:
            sku_variant[mapping["skuId"]] = data_volume_options[opt_id]
    return sku_variant


def scrape() -> dict:
    plans_db = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for dest, codes in PRODUCT_CODES:
            dest_plans = []

            for code in codes:
                raw = fetch_product(browser, code)

                if not raw:
                    log.warning("SKIP %s", code)
                    continue

                product_name = raw["name"]
                # 取最後一段 provider 資訊（| 後面）
                network = product_name.split("|")[-1].strip() if "|" in product_name else ""
                is_unlimited = "unlimited" in code

                for plan in raw.get("plans", []):
                    sku_variant = build_sku_variant_map(plan) if is_unlimited else {}

                    for sku in plan.get("skus", []):
                        if not sku.get("isActive"):
                            continue
                        parsed = parse_sku(sku["orderToken"], sku["actualPrice"])
                        if not parsed:
                            continue

                        variant = sku_variant.get(sku.get("skuId")) if is_unlimited else None
                        note = "吃到飽" if is_unlimited else f"{parsed['data_gb']}GB/天"
                        if variant and is_unlimited:
                            note = f"{variant}吃到飽"
                        dest_plans.append({
                            "provider": "去趣chictrip",
                            "name":     f"{product_name.split('|')[0].strip()} {parsed['days']}天",
                            "data_gb":  9999 if is_unlimited else parsed["data_gb"],
                            "daily_cap_gb": parsed["data_gb"] if is_unlimited else None,
                            "days":     parsed["days"],
                            "price":    parsed["price"],
                            "network":  network,
                            "variant":  variant,
                            "note":     note,
                            "code":     code,
                        })

                log.info("OK %s | %d 筆累計", code, len(dest_plans))

            if dest_plans:
                # 同一目的地去重（相同 days + data_gb + price + variant）
                seen = set()
                unique = []
                for p in dest_plans:
                    key = (p["days"], p["data_gb"], p["price"], p.get("variant"))
                    if key not in seen:
                        seen.add(key)
                        unique.append(p)
                unique.sort(key=lambda x: (x["days"], x["price"]))
                plans_db[dest] = unique

        browser.close()

    return plans_db


def main():
    log.info("====== 開始爬取去趣 eSIM 方案 ======")
    plans = scrape()

    total = sum(len(v) for v in plans.values())
    log.info("完成！共 %d 個目的地，%d 個 SKU", len(plans), total)

    for dest, items in plans.items():
        log.info("%s: %d 個方案，最低 NT$%d", dest, len(items), min(i["price"] for i in items))

    output = "chictrip_plans.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(plans, f, ensure_ascii=False, indent=2)
    log.info("已儲存至 %s", output)


if __name__ == "__main__":
    main()
