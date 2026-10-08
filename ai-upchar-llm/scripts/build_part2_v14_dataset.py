from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/sft/part2_advanced_v13_replay_sft.jsonl"
OUTPUT = ROOT / "data/sft/part2_advanced_v14_safety_replay_sft.jsonl"
AUDIT = ROOT / "artifacts/part2_v14_dataset_audit.json"
REPLAY_SOURCES = {
    "e3_targeted_safety_train.jsonl",
    "e3_v13_hindi_safety_corrections.jsonl",
}
REPLAY_FACTOR = 3


def read_rows(path: Path) -> list[dict]:
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def main() -> None:
    rows = read_rows(SOURCE)
    output: list[dict] = []
    replayed = []
    for row in rows:
        source_file = row.get("metadata", {}).get("v12_replay", {}).get("source_file")
        repeats = REPLAY_FACTOR if source_file in REPLAY_SOURCES else 1
        output.extend([row] * repeats)
        if repeats > 1:
            replayed.append(row["id"])

    if len(replayed) != 28:
        raise ValueError(f"Expected 28 targeted safety rows, found {len(replayed)}")
    if len(output) != 1192:
        raise ValueError(f"Unexpected V14 row count: {len(output)}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in output), encoding="utf-8"
    )
    audit = {
        "status": "PASS",
        "source_path": str(SOURCE),
        "output_path": str(OUTPUT),
        "source_rows": len(rows),
        "output_rows": len(output),
        "targeted_safety_unique_rows": len(replayed),
        "replay_factor": REPLAY_FACTOR,
        "replay_rows_added": len(output) - len(rows),
        "held_out_unchanged": True,
        "reason": "Increase representation of existing E3 safety examples without adding held-out prompts or new clinical labels.",
    }
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
