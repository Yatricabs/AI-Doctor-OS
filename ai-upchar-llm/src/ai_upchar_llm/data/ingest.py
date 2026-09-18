import json
from pathlib import Path

REQUIRED_SOURCE_FIELDS = {"source_id", "source_name", "source_type", "title", "license", "retrieval_date", "language", "domain", "quality_status"}


def ingest_jsonl(path: str | Path) -> list[dict]:
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    for row in rows:
        missing = REQUIRED_SOURCE_FIELDS - set(row.get("source", {}))
        if missing:
            raise ValueError(f"Missing source metadata: {sorted(missing)}")
    return rows
