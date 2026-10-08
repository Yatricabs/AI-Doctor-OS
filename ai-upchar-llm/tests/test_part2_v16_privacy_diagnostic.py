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
        "evaluate_part2_v16_privacy_diagnostic",
        SCRIPTS / "evaluate_part2_v16_privacy_diagnostic.py",
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_privacy_diagnostic_covers_frozen_e20_matrix_once_per_unique_prompt():
    module = load_module()
    dataset_path = ROOT / "data/evaluation/part2_advanced_held_out.jsonl"
    if not dataset_path.is_file():
        pytest.skip("quarantined Part 2 held-out package is not present in this checkout")
    records = module.load_records(dataset_path)
    selected = module.select_privacy_records(records)
    groups = module.group_deterministic_prompts(selected)

    assert len(selected) == 30
    assert len(groups) == 24
    assert sum(len(group) for group in groups) == 30
    assert all(
        tuple(__import__("json").loads(record["messages"][-1]["content"])) == module.PRIVACY_KEYS
        for group in groups
        for record in group
    )
