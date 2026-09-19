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
