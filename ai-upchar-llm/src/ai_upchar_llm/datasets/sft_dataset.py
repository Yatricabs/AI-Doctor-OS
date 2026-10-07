import json
from pathlib import Path

from .schema import PrivacyReview, SourceMetadata, TrainingExample


def load_sft(path: str | Path) -> list[TrainingExample]:
    examples = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        example = TrainingExample(source=SourceMetadata(**row.pop("source")), privacy=PrivacyReview(**row.pop("privacy")), **row)
        example.validate()
        examples.append(example)
    return examples


def conversational_rows(examples: list[TrainingExample]) -> list[dict[str, object]]:
    return [{"messages": item.messages, "task_type": item.task_type, "example_id": item.id} for item in examples]


def load_candidate_conversations(path: str | Path) -> list[dict[str, object]]:
    """Load explicitly marked pre-production candidate data without certifying it.

    Candidate packages use their own review metadata and are intentionally kept
    outside the clinical TrainingExample validator. This path is for internal
    model validation only; callers must set the non-production run marker.
    """
    rows: list[dict[str, object]] = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row.get("messages"), list) or not row["messages"]:
            raise ValueError(f"Candidate row has no messages: {row.get('id')}")
        rows.append({"messages": row["messages"], "example_id": row.get("id"), "candidate_metadata": row.get("metadata", {})})
    return rows
