import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "db.sqlite"

REPLACEMENTS = [
    ("当前已加载的小说章节列表", "当前已加载的古诗章节列表"),
    ("小说章节", "古诗章节"),
    ("小说内容", "古诗内容"),
    ("小说原文", "古诗原文"),
    ("分析小说原文", "分析古诗原文"),
    ("小说名", "作品名"),
    ("网文转短剧", "古诗词转短剧"),
]


def apply_replacements(text: str) -> str:
    result = text
    for old, new in REPLACEMENTS:
        result = result.replace(old, new)
    return result


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"db.sqlite not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, code, defaultValue FROM t_prompts WHERE code LIKE ?",
            ("poetryOutlineScript-%",),
        )
        rows = cursor.fetchall()
        if not rows:
            print("No poetryOutlineScript prompts found.")
            return

        updated = 0
        for prompt_id, code, default_value in rows:
            if default_value is None:
                continue
            new_value = apply_replacements(default_value)
            if new_value != default_value:
                cursor.execute(
                    "UPDATE t_prompts SET defaultValue = ? WHERE id = ?",
                    (new_value, prompt_id),
                )
                updated += 1

        conn.commit()
        print(f"Updated {updated} prompt(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
