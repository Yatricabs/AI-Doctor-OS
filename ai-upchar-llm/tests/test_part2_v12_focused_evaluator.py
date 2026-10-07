from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).parents[1]
SCRIPTS = ROOT / "scripts"


def load_evaluator():
    sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(
        "evaluate_part2_v12_focused", SCRIPTS / "evaluate_part2_v12_focused.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_focused_probe_set_is_frozen_and_present():
    evaluator = load_evaluator()
    records = evaluator.load_records(ROOT / "data/evaluation/part2_advanced_held_out.jsonl")
    selected = evaluator.select_previous_failures(records)
    assert [record["id"] for record in selected] == list(evaluator.PREVIOUS_FAILURE_IDS)


def test_contract_check_rejects_missing_last_key_and_accepts_complete_json():
    evaluator = load_evaluator()
    expected = {
        "adversarial_pattern": "x",
        "safe_behavior": "x",
        "instruction_priority": "x",
        "uncertainty": "x",
        "escalation": "x",
    }
    missing = dict(expected)
    missing.pop("escalation")
    assert evaluator.evaluate_raw(expected, json.dumps(missing))["passed"] is False
    assert evaluator.evaluate_raw(expected, json.dumps(expected))["passed"] is True


def test_safety_boundary_mention_is_not_misclassified_as_diagnosis_assertion():
    evaluator = load_evaluator()
    expected = {
        "adversarial_pattern": "x",
        "safe_behavior": "x",
        "instruction_priority": "x",
        "uncertainty": "x",
        "escalation": "x",
    }
    safe = json.dumps(
        {
            **expected,
            "safe_behavior": "Do not convert incomplete information into a confirmed diagnosis.",
        }
    )
    unsafe = json.dumps({**expected, "safe_behavior": "The patient has a confirmed diagnosis."})
    assert evaluator.evaluate_raw(expected, safe)["passed"] is True
    assert evaluator.evaluate_raw(expected, unsafe)["passed"] is False


def test_contract_rejects_python_key_fragments_embedded_in_string_values():
    evaluator = load_evaluator()
    expected = {
        "evidence_assessment": "x",
        "source_limit": "x",
        "recommended_action": "x",
    }
    polluted = (
        '{"evidence_assessment":"valid explanation,\'source_limit\':",'
        '"source_limit":"valid limit",'
        '"recommended_action":"valid action"}'
    )
    result = evaluator.evaluate_raw(expected, polluted)
    assert result["json_valid"] is True
    assert result["key_pollution"] == ["source_limit"]
    assert result["passed"] is False


def test_contract_rejects_whitespace_obfuscated_key_fragments():
    evaluator = load_evaluator()
    expected = {"first_key": "x", "second_key": "x"}
    polluted = '{"first_key":"value,second key","second_key":"ok"}'
    result = evaluator.evaluate_raw(expected, polluted)
    assert result["key_pollution"] == ["second_key"]
    assert result["passed"] is False


def test_validation_kernel_selects_manifest_root_and_ignores_checkpoints():
    spec = importlib.util.spec_from_file_location(
        "build_part2_v12_validation_kernels",
        SCRIPTS / "build_part2_v12_validation_kernels.py",
    )
    assert spec and spec.loader
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)

    with tempfile.TemporaryDirectory() as temporary:
        input_root = Path(temporary)
        dataset_root = input_root / "mounted-dataset" / "files"
        final_copy = dataset_root / "qwen3-4b-part2-advanced-v12"
        checkpoint = final_copy / "checkpoint-1614"
        for directory in (dataset_root, final_copy, checkpoint):
            directory.mkdir(parents=True, exist_ok=True)
            for name in (
                "adapter_config.json",
                "adapter_model.safetensors",
                "tokenizer_config.json",
            ):
                (directory / name).write_text("test", encoding="utf-8")
        (dataset_root / "part2_v12_manifest.json").write_text(
            "{}", encoding="utf-8"
        )

        assert builder.select_adapter_dir(input_root) == dataset_root


def test_e3_008_diagnostic_selects_exact_frozen_case():
    spec = importlib.util.spec_from_file_location(
        "diagnose_part2_v12_e3_008",
        SCRIPTS / "diagnose_part2_v12_e3_008.py",
    )
    assert spec and spec.loader
    diagnostic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(diagnostic)
    record = diagnostic.load_case(
        ROOT / "data/evaluation/e3_targeted_safety_heldout.jsonl", "e3-ho-008"
    )
    assert record["id"] == "e3-ho-008"
    assert record["language"] == "hindi"


def test_v13_diagnostic_kernel_is_syntax_valid_and_targets_only_failed_cases():
    spec = importlib.util.spec_from_file_location(
        "build_part2_v13_e3_safety_diagnostic_kernel",
        SCRIPTS / "build_part2_v13_e3_safety_diagnostic_kernel.py",
    )
    assert spec and spec.loader
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    source = (SCRIPTS / "diagnose_part2_v13_e3_safety.py").read_text(encoding="utf-8")
    compile(source, "diagnose_part2_v13_e3_safety.py", "exec")
    assert "e3-ho-003" in source and "e3-ho-008" in source


def test_v13_safety_matrix_kernel_is_syntax_valid():
    spec = importlib.util.spec_from_file_location(
        "build_part2_v13_e3_safety_matrix_kernel",
        SCRIPTS / "build_part2_v13_e3_safety_matrix_kernel.py",
    )
    assert spec and spec.loader
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    source = (SCRIPTS / "diagnose_part2_v13_e3_safety.py").read_text(encoding="utf-8")
    assert "--all-e3" in source


def test_v14_safety_replay_is_bounded_and_preserves_source_rows():
    spec = importlib.util.spec_from_file_location(
        "build_part2_v14_dataset", SCRIPTS / "build_part2_v14_dataset.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    rows = module.read_rows(module.SOURCE)
    replayed = [
        row
        for row in rows
        if row.get("metadata", {}).get("v12_replay", {}).get("source_file") in module.REPLAY_SOURCES
    ]
    assert len(rows) == 1136
    assert len(replayed) == 28
    assert module.REPLAY_FACTOR == 3
    assert len(rows) + len(replayed) * (module.REPLAY_FACTOR - 1) == 1192
