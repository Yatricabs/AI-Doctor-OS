from __future__ import annotations

import hashlib
import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/sft/part2_advanced_v14_safety_replay_sft.jsonl"
OUTPUT = ROOT / "data/sft/part2_advanced_v16_contract_replay_sft.jsonl"
AUDIT = ROOT / "artifacts/part2_v16_dataset_audit.json"

E12_PATTERN = "new rash after a prescription change"
E20_PATTERN = "exact date of birth"
E12_EXTRA_COPIES = 3
E20_EXTRA_COPIES = 9


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def user_text(row: dict[str, Any]) -> str:
    return next(message["content"] for message in row["messages"] if message["role"] == "user")


def build_dataset() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    source = read_jsonl(SOURCE)
    e12 = [row for row in source if E12_PATTERN in user_text(row)]
    e20 = [row for row in source if E20_PATTERN in user_text(row)]
    if len(source) != 1192 or len(e12) != 20 or len(e20) != 3:
        raise ValueError(
            {
                "source": len(source),
                "e12_contract_anchors": len(e12),
                "e20_contract_anchors": len(e20),
            }
        )

    output = list(source)
    for rows, copies, label in (
        (e12, E12_EXTRA_COPIES, "e12_json_contract"),
        (e20, E20_EXTRA_COPIES, "e20_json_contract"),
    ):
        for copy_index in range(1, copies + 1):
            for row in rows:
                replay = deepcopy(row)
                replay.setdefault("metadata", {})["v16_contract_replay"] = {
                    "source_id": row["id"],
                    "reason": label,
                    "copy": copy_index,
                }
                output.append(replay)

    expected = 1192 + 20 * E12_EXTRA_COPIES + 3 * E20_EXTRA_COPIES
    if len(output) != expected:
        raise AssertionError((len(output), expected))
    for row in output:
        assistant = next(
            message["content"] for message in row["messages"] if message["role"] == "assistant"
        )
        parsed = json.loads(assistant.removesuffix("<|endoftext|>"))
        if not isinstance(parsed, dict) or not parsed:
            raise ValueError(f"Invalid assistant JSON for {row.get('id')}")

    phase_counts = Counter(str(row.get("metadata", {}).get("phase", "legacy")) for row in output)
    audit = {
        "status": "PASS",
        "source": str(SOURCE.relative_to(ROOT)),
        "output": str(OUTPUT.relative_to(ROOT)),
        "source_rows": len(source),
        "output_rows": len(output),
        "held_out_rows_added": 0,
        "e12_contract_anchor_rows": len(e12),
        "e12_extra_copies": E12_EXTRA_COPIES,
        "e20_contract_anchor_rows": len(e20),
        "e20_extra_copies": E20_EXTRA_COPIES,
        "phase_counts": dict(sorted(phase_counts.items())),
    }
    return output, audit


def main() -> None:
    rows, audit = build_dataset()
    OUTPUT.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )
    audit["sha256"] = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
