from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from ai_upchar_llm.config import load_config


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def load_builder():
    sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(
        "build_part2_v16_dataset", SCRIPTS / "build_part2_v16_dataset.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_v16_replays_only_approved_train_rows() -> None:
    builder = load_builder()
    rows, audit = builder.build_dataset()
    assert audit["status"] == "PASS"
    assert audit["source_rows"] == 1192
    assert audit["output_rows"] == 1279
    assert audit["held_out_rows_added"] == 0
    replay = [row for row in rows if "v16_contract_replay" in row.get("metadata", {})]
    assert len(replay) == 87
    assert all(row["metadata"]["review_status"] == "CLINICIAN_HAS_APPROVED" for row in replay)


def test_v16_is_low_rate_single_epoch_adapter_continuation() -> None:
    config = load_config(ROOT / "configs/qwen3-4b-part2-advanced-v16.yaml")
    training = config["training"]
    assert training["epochs"] == 1
    assert training["learning_rate"] == 0.00002
    assert training["initial_adapter_path"] == "__V15_ADAPTER_REQUIRED_AT_RUNTIME__"
    assert training["device_map"] == "single_gpu"
    assert config["data"]["production_approved"] is False
