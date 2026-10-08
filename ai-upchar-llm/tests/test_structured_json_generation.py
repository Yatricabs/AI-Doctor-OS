from __future__ import annotations

import ast
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))


def load_module():
    spec = importlib.util.spec_from_file_location(
        "structured_json_generation", SCRIPTS / "structured_json_generation.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parser_accepts(parser, text: str) -> bool:
    for character in text:
        if character not in parser.get_allowed_characters():
            return False
        parser = parser.add_character(character)
    return parser.can_end()


def test_sequence_parser_forces_keys_and_preserves_heterogeneous_values():
    pytest.importorskip("lmformatenforcer")
    module = load_module()
    expected = {"first": "example", "second": ["example"], "third": False}

    assert parser_accepts(
        module.build_ordered_json_parser(expected),
        '{"first":{"nested":["value"]},"second":"also valid","third":true}',
    )
    assert not parser_accepts(
        module.build_ordered_json_parser(expected),
        '{"second":"wrong order","first":"invalid","third":true}',
    )
    assert not parser_accepts(
        module.build_ordered_json_parser(expected),
        '{"first":"valid","second":"valid","extra":1,"third":true}',
    )


def test_sequence_parser_rejects_v16_v2_key_spill_regression():
    pytest.importorskip("lmformatenforcer")
    module = load_module()
    expected = {
        "evidence_assessment": "required",
        "source_limit": "required",
        "recommended_action": "required",
        "citation_rule": "required",
        "uncertainty": "required",
    }
    recorded_failure_shape = (
        '{"evidence_assessment":"value\',\'source_limit\':",'
        '"recommended_action":"value","uncertainty":"value",'
        '"source_limit":"indirect evidence","citation_rule":"value"}'
    )
    assert json.loads(recorded_failure_shape)
    assert not parser_accepts(module.build_ordered_json_parser(expected), recorded_failure_shape)


def test_ordered_sequence_preserves_lmfe_json_freetext_shortcut():
    pytest.importorskip("lmformatenforcer")
    module = load_module()
    expected = {
        "evidence_assessment": "required",
        "source_limit": "required",
        "recommended_action": "required",
    }
    parser = module.build_ordered_json_parser(expected)
    for character in '{"evidence_assessment":"':
        parser = parser.add_character(character)

    shortcut = parser.shortcut_key()
    assert isinstance(shortcut, tuple)
    assert shortcut[0] == "ai_upchar_json_freetext"


def test_ordered_sequence_rejects_unexpected_key_without_exhaustive_traversal():
    pytest.importorskip("lmformatenforcer")
    module = load_module()
    expected = {"first": "value", "second": "value"}
    parser = module.build_ordered_json_parser(expected)
    for character in '{"first":"ok",':
        parser = parser.add_character(character)
    assert '"second"' not in parser.get_allowed_characters()
    assert '"' in parser.get_allowed_characters()


def test_allowed_token_cache_is_namespaced_by_complete_key_schema():
    module = load_module()
    tokenizer_data = object()
    first = module._allowed_token_cache_namespace(
        tokenizer_data, ("privacy_action", "data_minimization")
    )
    same = module._allowed_token_cache_namespace(
        tokenizer_data, ("privacy_action", "data_minimization")
    )
    different = module._allowed_token_cache_namespace(
        tokenizer_data, ("semantic_interpretation", "recommended_action")
    )

    assert first == same
    assert first != different


def test_empty_decoder_state_uses_auditable_eos_fallback():
    module = load_module()
    assert module._allowed_tokens_or_eos_fallback([7, 8], 99) == ([7, 8], False)
    assert module._allowed_tokens_or_eos_fallback([], [99, 99, None]) == ([99], True)
    with pytest.raises(RuntimeError, match="no valid EOS fallback"):
        module._allowed_tokens_or_eos_fallback([], None)


def test_all_frozen_assistant_contracts_fit_ordered_grammar():
    pytest.importorskip("lmformatenforcer")
    module = load_module()
    paths = [
        ROOT / "data/evaluation/part2_advanced_held_out.jsonl",
        ROOT / "data/evaluation/e3b_patient_interview_held_out.jsonl",
        ROOT / "data/evaluation/e2_held_out_contract.jsonl",
        ROOT / "data/evaluation/e3_targeted_safety_heldout.jsonl",
    ]
    records = [
        json.loads(line)
        for path in paths
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    alphabet = "".join(
        sorted(set("".join(record["messages"][-1]["content"] for record in records)))
    )
    assert len(records) == 413
    for record in records:
        expected = json.loads(record["messages"][-1]["content"])
        compact = json.dumps(expected, ensure_ascii=False, separators=(",", ":"))
        assert parser_accepts(
            module.build_ordered_json_parser(expected, alphabet=alphabet), compact
        ), record.get("id")


def test_qwen_boundary_tokens_remain_allowed_for_recorded_failures():
    """Qwen's `.","` token must cross value/key boundaries legally."""
    tokenizer_path = ROOT.parent / "local-artifacts/kaggle/uploads/part2-v16-adapter-dataset"
    transformers = pytest.importorskip("transformers")
    pytest.importorskip("torch")
    lmfe_transformers = pytest.importorskip("lmformatenforcer.integrations.transformers")
    from lmformatenforcer.tokenenforcer import TokenEnforcerTokenizerData

    if not tokenizer_path.is_dir():
        pytest.skip("local Qwen tokenizer artifact is unavailable")

    module = load_module()
    tokenizer = transformers.AutoTokenizer.from_pretrained(
        tokenizer_path, local_files_only=True, trust_remote_code=True
    )

    def batched_tokenizer_data(tokenizer, use_bitmask=False, vocab_size=None):
        vocab_size = vocab_size or len(tokenizer)
        special_ids = set(tokenizer.all_special_ids)
        token_ids = [i for i in range(vocab_size) if i not in special_ids]
        regular = tokenizer.batch_decode([[i] for i in token_ids])
        token_zero = tokenizer.encode("0")[-1]
        after_zero = tokenizer.batch_decode([[token_zero, i] for i in token_ids])
        regular_tokens = [
            (i, pair[1:], len(pair[1:]) > len(single))
            for i, single, pair in zip(token_ids, regular, after_zero, strict=True)
        ]
        return TokenEnforcerTokenizerData(
            regular_tokens,
            lambda ids: tokenizer.decode(ids).rstrip("\ufffd"),
            tokenizer.eos_token_id,
            use_bitmask,
            vocab_size,
        )

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        lmfe_transformers,
        "build_token_enforcer_tokenizer_data",
        batched_tokenizer_data,
    )
    paths = [ROOT / "data/evaluation/part2_advanced_held_out.jsonl"]
    recorded_ids = {"E17-heldout-0013", "E20-heldout-0001", "E20-heldout-0025"}
    records = [
        json.loads(line)
        for path in paths
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and json.loads(line).get("id") in recorded_ids
    ]

    class TensorLike(list):
        def tolist(self):
            return list(self)

    try:
        for record in records:
            expected = json.loads(record["messages"][-1]["content"])
            prefix_filter = module.build_json_prefix_allowed_tokens_fn(tokenizer, expected)
            prompt = tokenizer.apply_chat_template(
                [{"role": "user", "content": record["messages"][0]["content"]}],
                add_generation_prompt=True,
                tokenize=False,
            )
            sequence = tokenizer(prompt, add_special_tokens=False)["input_ids"]
            target = tokenizer(record["messages"][-1]["content"], add_special_tokens=False)[
                "input_ids"
            ]
            for token_id in target:
                allowed = prefix_filter(0, TensorLike(sequence))
                assert allowed, record["id"]
                assert token_id in allowed, (record["id"], token_id)
                sequence.append(token_id)
            assert prefix_filter.empty_fallback_count == 0, record["id"]
    finally:
        monkeypatch.undo()


def test_every_active_evaluation_generate_call_uses_structured_decoding():
    for filename in ("evaluate_part2_v12_focused.py", "evaluate_e3_safety.py"):
        tree = ast.parse((SCRIPTS / filename).read_text(encoding="utf-8"))
        generate_calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "generate"
        ]
        assert generate_calls, filename
        assert all(
            "prefix_allowed_tokens_fn" in {keyword.arg for keyword in call.keywords}
            for call in generate_calls
        ), filename


def test_cloud_validation_builder_pins_tokenizer_bridge_dependency():
    source = (SCRIPTS / "build_part2_v16_structured_validation_kernels.py").read_text(
        encoding="utf-8"
    )
    assert "lm-format-enforcer==0.11.3" in source


def test_cloud_validation_source_is_minimal_and_excludes_training_data():
    sys.path.insert(0, str(SCRIPTS))
    import build_part2_v16_structured_validation_kernels as builder

    assert len(builder.SOURCE_FILES) == 12
    assert all((ROOT / path).is_file() for path in builder.SOURCE_FILES)
    assert not any(path.startswith("data/sft/") for path in builder.SOURCE_FILES)
    assert not any("v17" in path for path in builder.SOURCE_FILES)
