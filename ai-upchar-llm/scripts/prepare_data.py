import argparse
import json
from pathlib import Path

from ai_upchar_llm.data.cleaning import normalize_text
from ai_upchar_llm.data.dedup import deduplicate
from ai_upchar_llm.data.deidentification import contains_direct_identifier, deidentify


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("input"); parser.add_argument("output"); args = parser.parse_args()
    rows, rejected = [], 0
    for line in Path(args.input).read_text(encoding="utf-8").splitlines():
        row = json.loads(line); text, findings = deidentify(normalize_text(row.get("text", "")))
        if contains_direct_identifier(text) or not row.get("privacy_review_approved"):
            rejected += 1; continue
        row["text"], row["deidentification_findings"] = text, findings; rows.append(row)
    unique, duplicates = deduplicate([json.dumps(row, sort_keys=True) for row in rows])
    Path(args.output).write_text("\n".join(unique) + "\n", encoding="utf-8")
    print(json.dumps({"accepted": len(unique), "rejected": rejected, "duplicates": duplicates}))


if __name__ == "__main__": main()
