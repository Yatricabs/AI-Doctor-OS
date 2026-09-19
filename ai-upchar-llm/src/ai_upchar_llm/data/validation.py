from pathlib import Path

from ai_upchar_llm.datasets.sft_dataset import load_sft


def validate_dataset(path: str | Path) -> dict[str, int]:
    examples = load_sft(path)
    ids = [item.id for item in examples]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate example ids are forbidden")
    return {"examples": len(examples), "approved": len(examples), "rejected": 0}
