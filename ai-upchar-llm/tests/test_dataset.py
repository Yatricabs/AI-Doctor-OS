from pathlib import Path
from ai_upchar_llm.data.deidentification import deidentify
from ai_upchar_llm.data.validation import validate_dataset

ROOT = Path(__file__).parents[1]

def test_smoke_dataset_is_approved():
    assert validate_dataset(ROOT / "data/sft/smoke.jsonl")["approved"] == 2

def test_direct_identifiers_are_removed():
    text, findings = deidentify("Call 9876543210 or a@b.com")
    assert "9876543210" not in text and "a@b.com" not in text and findings == ["PHONE", "EMAIL"]
