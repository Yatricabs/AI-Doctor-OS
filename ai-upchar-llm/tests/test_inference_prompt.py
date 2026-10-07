"""GPU-free tests for the Gate B inference-format remediation.

These verify that inference is now chat-template formatted and primed for the
assistant turn (consistent with SFT training), that the JSON-only instruction is
present, that the legacy raw-string inference path is gone, and that the Gate B
evaluator is unchanged. No Qwen weights and no CUDA are required."""

from pathlib import Path

from ai_upchar_llm.training.real_qlora import (
    CONTRACT_REQUIRED_KEYS,
    INFERENCE_MAX_NEW_TOKENS,
    INFERENCE_USER_MESSAGE,
    build_inference_prompt,
    evaluate_contract_json,
)

SOURCE = Path(__file__).parents[1] / "src" / "ai_upchar_llm" / "training" / "real_qlora.py"


class _FakeTokenizer:
    """Minimal stand-in that records how apply_chat_template was called and
    emits a deterministic chat-formatted string. No model weights involved."""

    def __init__(self):
        self.calls = []

    def apply_chat_template(self, messages, add_generation_prompt=False, tokenize=True):
        self.calls.append({
            "messages": messages,
            "add_generation_prompt": add_generation_prompt,
            "tokenize": tokenize,
        })
        rendered = "".join(f"<|{m['role']}|>\n{m['content']}\n" for m in messages)
        if add_generation_prompt:
            rendered += "<|assistant|>\n"
        return rendered


def test_inference_prompt_uses_chat_template_and_generation_prompt():
    tok = _FakeTokenizer()
    prompt = build_inference_prompt(tok)
    assert tok.calls, "apply_chat_template must be used for inference"
    call = tok.calls[0]
    assert call["add_generation_prompt"] is True
    assert call["tokenize"] is False
    assert call["messages"] == [{"role": "user", "content": INFERENCE_USER_MESSAGE}]
    # The rendered prompt must prime the assistant turn.
    assert prompt.rstrip().endswith("<|assistant|>")


def test_inference_message_is_json_only_instruction():
    lowered = INFERENCE_USER_MESSAGE.lower()
    assert "json" in lowered
    assert "only" in lowered
    assert "no explanatory prose" in lowered
    assert "no markdown" in lowered


def test_inference_message_names_required_contract_keys():
    # The prompt must explicitly name the required contract keys so a weakly
    # trained model is steered toward the AI UPCHAR schema. The evaluator is
    # unchanged; this only makes the request specific.
    for key in CONTRACT_REQUIRED_KEYS:
        assert key in INFERENCE_USER_MESSAGE, f"required key missing from prompt: {key}"
    # The prompt names the complete current SFT top-level schema (six keys).
    for key in (
        "semantic_interpretation",
        "recommended_action",
        "next_best_question",
        "missing_information",
        "clinical_considerations",
        "confidence",
    ):
        assert key in INFERENCE_USER_MESSAGE, f"SFT schema key missing from prompt: {key}"


def test_generation_budget_is_increased():
    assert INFERENCE_MAX_NEW_TOKENS == 512


def test_legacy_raw_string_inference_path_removed():
    src = SOURCE.read_text(encoding="utf-8")
    # The old raw prompt string must no longer be used for inference.
    assert 'Return the AI UPCHAR clinical reasoning JSON contract."' not in src
    assert "max_new_tokens=128" not in src
    # Inference must go through the chat-template helper with a generation prompt.
    assert "build_inference_prompt(tokenizer)" in src
    assert "add_generation_prompt=True" in src
    assert "max_new_tokens=INFERENCE_MAX_NEW_TOKENS" in src


def test_gate_b_evaluator_is_unchanged():
    # Contract keys and evaluator behavior must remain exactly as before.
    assert CONTRACT_REQUIRED_KEYS == ("semantic_interpretation", "recommended_action")

    # No JSON at all -> no_json_object_present (unchanged behavior).
    assert evaluate_contract_json("just prose, no json here")["reason"] == "no_json_object_present"

    # Open brace, no closing brace anywhere -> truncated (unchanged behavior).
    assert evaluate_contract_json('{"semantic_interpretation": "abc')["reason"] == "truncated_before_closing_brace"

    # Valid contract JSON -> valid (unchanged behavior).
    good = '{"semantic_interpretation": {"problems": []}, "recommended_action": "ASK_QUESTION"}'
    verdict = evaluate_contract_json(good)
    assert verdict["valid"] is True

    # Valid JSON missing a required key -> not valid (unchanged behavior).
    missing = evaluate_contract_json('{"recommended_action": "ASK_QUESTION"}')
    assert missing["valid"] is False and missing["reason"] == "missing_contract_keys"

    # The evaluator source must not have been relaxed.
    src = SOURCE.read_text(encoding="utf-8")
    assert "def evaluate_contract_json" in src
    assert 'CONTRACT_REQUIRED_KEYS = ("semantic_interpretation", "recommended_action")' in src
