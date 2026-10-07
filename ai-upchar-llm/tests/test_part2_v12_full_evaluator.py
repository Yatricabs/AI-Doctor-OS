from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).parents[1]
SCRIPTS = ROOT / "scripts"


def load_evaluator():
    sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(
        "evaluate_part2_v12_full", SCRIPTS / "evaluate_part2_v12_full.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_full_evaluator_preserves_frozen_and_unique_counts():
    evaluator = load_evaluator()
    records = evaluator.load_records(ROOT / "data/evaluation/part2_advanced_held_out.jsonl")
    results = [{"passed": True} for _ in records]
    summary = evaluator.summarize_part2(records, results)
    assert summary["total"] == 390
    assert summary["passed"] == 390
    assert summary["unique_prompts_total"] == 184
    assert summary["unique_prompts_passed"] == 184


def test_multilingual_probe_matrix_is_complete_and_nonclinical():
    evaluator = load_evaluator()
    records = evaluator.multilingual_records()
    assert len(records) == 6
    assert {record["metadata"]["language"] for record in records} == {
        "english",
        "hindi",
        "hinglish",
    }
    assert all(record["metadata"]["probe_type"] == "engineering" for record in records)


def test_frozen_safety_generation_budget_preserves_hindi_json_contracts():
    sys.path.insert(0, str(SCRIPTS))
    import evaluate_e3_safety

    assert evaluate_e3_safety.SAFETY_MAX_NEW_TOKENS == 512
