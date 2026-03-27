import pandas as pd
import json
from datetime import datetime

# =========================
# ★① ファイル名
# =========================
input_file = "zaiko.xlsx"
output_file = "zaiko.json"

# =========================
# ★② 列名（Excelと一致）
# =========================
col_process = "部署"
col_item = "部番"

# =========================
# 日付フォーマット（ここ重要）
# =========================
def format_date(d):
    if isinstance(d, datetime):
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        w = weekdays[d.weekday()]
        return f"{d.month}/{d.day}({w})"
    else:
        return str(d)

# =========================
# Excel読み込み
# =========================
df = pd.read_excel(input_file)

# =========================
# 日付列を自動取得
# =========================
date_columns = [col for col in df.columns if col not in [col_process, col_item]]

# =========================
# JSON変換
# =========================
result = []

for _, row in df.iterrows():
    item = {
        col_process: str(row[col_process]).strip(),
        col_item: str(row[col_item]).strip(),
        "在庫": {}
    }

    for date in date_columns:
        value = row[date]

        if pd.isna(value):
            value = None

        item["在庫"][format_date(date)] = value

    result.append(item)

# =========================
# 出力
# =========================
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("JSON変換完了:", output_file)