import pandas as pd
import json

input_file = "koutei.xlsx"
output_file = "koutei.json"

df = pd.read_excel(input_file)

result = []

for _, row in df.iterrows():
    processes = []

    # 工程1〜8
    for i in range(1, 9):
        val = row.get(f"工程{i}")

        if pd.notna(val):
            processes.append(str(val).strip())

    result.append({
        "品番": str(row["部番"]).strip(),
        "図番": str(row["図番(REV)"]).strip(),
        "工程": processes
    })

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("JSON作成完了")