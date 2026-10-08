from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def load_module():
    sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(
        "evaluate_part2_v16_focused", SCRIPTS / "evaluate_part2_v16_focused.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_v16_focused_matrix_contains_exact_v15_part2_failures() -> None:
    module = load_module()
    held_out = ROOT / "data/evaluation/part2_advanced_held_out.jsonl"
    if not held_out.is_file():
        pytest.skip("external Part 2 held-out package is unavailable")
    records = module.load_records(held_out)
    selected = module.select_v15_failures(records)
    assert {record["id"] for record in selected} == module.V15_PART2_FAILURE_IDS
    assert len(selected) == 4
