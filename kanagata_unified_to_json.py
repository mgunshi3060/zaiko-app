r"""
金型一覧統合 Excel → JSON 変換スクリプト
  社内金型: \\Sd-server\製品技術業務\固定資産関係\社内金型一覧表.xlsx
  外注PX  : \\Sd-server\製品技術業務\固定資産関係\外注PX一覧表.xls
出力先    : \\DENOU-NAS\Access\在庫\金型一覧統合.json

共通スキーマ（20フィールド）:
  フラグ / 部番 / 部材部番 / 品名 / 置場 / 写真撮影日 / 型共用等 /
  仕様トン数 / 工程数 / 工程名称 / 金型製造先 / 備考 /
  資産登録有無 / 管理元 / 資産NO / 借用証受渡確認票 /
  固定資産プレート / 金型識別プレート / 所在状況 / 備考2
"""

import pandas as pd
import json
import sys
from pathlib import Path

# ──────────────────────────────────────────────
# 共通スキーマのキー名（出力JSONのフィールド名）
# ──────────────────────────────────────────────
SCHEMA_KEYS = [
    "フラグ",
    "部番",
    "部材部番",
    "品名",
    "置場",
    "写真撮影日",
    "型共用等",
    "仕様トン数",
    "工程数",
    "工程名称",
    "金型製造先",
    "備考",
    "資産登録有無",
    "管理元",
    "資産NO",
    "借用証受渡確認票",
    "固定資産プレート",
    "金型識別プレート",
    "所在状況",
    "備考2",
]

# ──────────────────────────────────────────────
# 社内金型 列マッピング（Excelの列名 → 共通キー）
# ──────────────────────────────────────────────
SHAKAI_MAPPING = {
    "No"                        : None,           # 除外（連番）
    "部番"                      : "部番",
    "部材部番"                  : "部材部番",
    "品名"                      : "品名",
    "置場"                      : "置場",
    "写真撮影日"                : "写真撮影日",
    "型共用等"                  : "型共用等",
    "仕様トン数"                : "仕様トン数",
    "工程数"                    : "工程数",
    "工程名称"                  : "工程名称",
    "金型製造先"                : "金型製造先",
    "備考"                      : "備考",
    "資産登録有/無(経費金型調査)": "資産登録有無",
    "管理元"                    : "管理元",
    "資産NO"                    : "資産NO",
    "借用証/受渡確認票"         : "借用証受渡確認票",
    "固定資産プレート"          : "固定資産プレート",
    "金型識別プレート"          : "金型識別プレート",
    "所在状況"                  : "所在状況",
    "備考.1"                    : "備考2",
}

# ──────────────────────────────────────────────
# 外注PX 列マッピング（Excelの列名 → 共通キー）
# ──────────────────────────────────────────────
GAICHUU_MAPPING = {
    "顧客"                                      : "フラグ",   # 顧客名をフラグとして使用
    "部番"                                      : "部番",
    "部材部番"                                  : "部材部番",
    "品名"                                      : "品名",
    "加工先"                                    : "置場",
    "写真撮影日"                                : "写真撮影日",
    "型共用部品"                                : "型共用等",
    "仕様トン数"                                : "仕様トン数",
    "工程数"                                    : "工程数",
    "工程名称"                                  : "工程名称",
    "金型製造先"                                : "金型製造先",
    "備考"                                      : "備考",
    "資産登録有/無（2013年時点）（経費金型調査）": "資産登録有無",
    "管理元"                                    : "管理元",
    "資産NO"                                    : "資産NO",
    "借用証/受渡確認票"                         : "借用証受渡確認票",
    "固定資産プレート"                          : "固定資産プレート",
    "金型識別プレート"                          : "金型識別プレート",
    "所在状況"                                  : "所在状況",
    "機種"                                      : "備考2",
}


def read_excel(path: str) -> pd.DataFrame:
    """3行目ヘッダー・A〜T列（20列）で読み込み、空行除去・文字列トリムを行う"""
    df = pd.read_excel(path, header=2, usecols=range(20))
    df.dropna(how="all", inplace=True)
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].str.strip()
    return df


def to_unified_records(df: pd.DataFrame, col_mapping: dict, fixed_flag: str = None) -> list[dict]:
    """DataFrameを共通スキーマのレコードリストに変換する"""
    records = []
    for _, row in df.iterrows():
        record = {key: None for key in SCHEMA_KEYS}

        for excel_col, schema_key in col_mapping.items():
            if schema_key is None:
                continue
            val = row.get(excel_col)
            record[schema_key] = None if pd.isna(val) else val

        # 固定フラグが指定されている場合は上書き
        if fixed_flag is not None:
            record["フラグ"] = fixed_flag

        records.append(record)
    return records


def convert(shakai_path: str, gaichuu_path: str, output_path: str) -> list[dict]:
    # 社内金型（フラグ固定値: "社内"）
    df_shakai  = read_excel(shakai_path)
    df_shakai.rename(columns={0: "No"}, inplace=True)
    records_shakai = to_unified_records(df_shakai, SHAKAI_MAPPING, fixed_flag="社内")

    # 外注PX（フラグ = 顧客列の値）
    df_gaichuu = read_excel(gaichuu_path)
    records_gaichuu = to_unified_records(df_gaichuu, GAICHUU_MAPPING)

    all_records = records_shakai + records_gaichuu

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)

    print(f"✅ 統合完了: 社内 {len(records_shakai)} 件 + 外注 {len(records_gaichuu)} 件"
          f" = 合計 {len(all_records)} 件 → {output_path}")
    return all_records


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        SHAKAI_PATH  = sys.argv[1]
        GAICHUU_PATH = sys.argv[2]
        OUTPUT_PATH  = sys.argv[3] if len(sys.argv) >= 4 else r"\\DENOU-NAS\Access\在庫\金型一覧統合.json"
    else:
        SHAKAI_PATH  = r"\\Sd-server\製品技術業務\固定資産関係\社内金型一覧表.xlsx"
        GAICHUU_PATH = r"\\Sd-server\製品技術業務\固定資産関係\外注PX一覧表.xls"
        OUTPUT_PATH  = r"\\DENOU-NAS\Access\在庫\金型一覧統合.json"

    data = convert(SHAKAI_PATH, GAICHUU_PATH, OUTPUT_PATH)

    print("\n--- プレビュー（先頭2件） ---")
    print(json.dumps(data[:2], ensure_ascii=False, indent=2))
