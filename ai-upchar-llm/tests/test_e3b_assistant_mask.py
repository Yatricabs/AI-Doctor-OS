"""Regression coverage for E3B assistant-only loss tokenization.

This test uses the same Qwen3 tokenizer and explicit generation-marked template
used by the E3B trainer. It prevents a return to the failing default-template
path, which produced empty assistant masks in TRL.
"""

import json
from pathlib import Path

from transformers import AutoTokenizer
from ai_upchar_llm.training.real_qlora import _append_assistant_eos


MODEL_ID = "Qwen/Qwen3-4B-Base"
DATA_ROOT = Path(__file__).parents[1] / "data"

CHAT_TEMPLATE = (
    "{% for message in messages %}"
    "{% if message['role'] == 'user' %}"
    "{{ '<|im_start|>user\\n' + message['content'] + '<|im_end|>\\n' }}"
    "{% elif message['role'] == 'system' %}"
    "{{ '<|im_start|>system\\n' + message['content'] + '<|im_end|>\\n' }}"
    "{% elif message['role'] == 'assistant' %}"
    "{{ '<|im_start|>assistant\\n' }}"
    "{% generation %}{{ message['content'] }}{% endgeneration %}"
    "{{ '<|im_end|>\\n' }}"
    "{% endif %}"
    "{% endfor %}"
    "{% if add_generation_prompt %}{{ '<|im_start|>assistant\\n' }}{% endif %}"
)


def _rows(relative_path: str):
    path = DATA_ROOT / relative_path
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def test_e3b_and_e2_have_non_empty_assistant_masks():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    tokenizer.chat_template = CHAT_TEMPLATE

    for relative_path in (
        "sft/e3b_patient_interview_sft.jsonl",
        "evaluation/e3b_patient_interview_held_out.jsonl",
        "sft/e2_contract_sft.jsonl",
    ):
        for index, row in enumerate(_rows(relative_path)):
            encoded = tokenizer.apply_chat_template(
                row["messages"],
                tokenize=True,
                return_dict=True,
                return_assistant_tokens_mask=True,
                add_generation_prompt=False,
            )
            mask = encoded["assistant_masks"]
            assert sum(mask) > 0, f"empty assistant mask: {relative_path}:{index}"


def test_e3b_is_not_truncated_at_training_length():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    tokenizer.chat_template = CHAT_TEMPLATE

    for relative_path in (
        "sft/e3b_patient_interview_sft.jsonl",
        "evaluation/e3b_patient_interview_held_out.jsonl",
    ):
        for index, row in enumerate(_rows(relative_path)):
            encoded = tokenizer.apply_chat_template(row["messages"], tokenize=True)
            assert len(encoded) <= 1536, f"unexpected truncation risk: {relative_path}:{index}"


def test_e3b_assistant_eos_is_appended_when_enabled():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    rows = _append_assistant_eos(_rows("sft/e3b_patient_interview_sft.jsonl"), tokenizer.eos_token)
    assert rows
    assert all(row["messages"][-1]["content"].endswith(tokenizer.eos_token) for row in rows)
