"""E2 Held-Out Evaluation Harness (ADDITIVE — does not modify frozen code).

This harness scores the 6 INDEPENDENT E2 held-out cases
(data/evaluation/e2_held_out_contract.jsonl) against the trained/reloaded E2
QLoRA adapter, using the FROZEN contract evaluator.

IMPORTANT — WHAT THIS IS AND IS NOT:
  * This is NOT trainer.evaluate(). trainer.evaluate() computes cross-entropy
    LOSS on the internal 31-record eval split created by train_test_split
    inside real_qlora.py. That is an in-loop optimization signal, not a
    behavioral contract check.
  * This harness is a POST-TRAINING GENERALIZATION test. It feeds each of the 6
    independent held-out user messages through the reloaded adapter and judges
    the raw generation with the UNCHANGED evaluate_contract_json (Gate B logic).

FROZEN / NOT MODIFIED BY THIS SCRIPT:
  * evaluate_contract_json         (imported, called as-is)
  * CONTRACT_REQUIRED_KEYS         (imported, only read for reporting)
  * INFERENCE_MAX_NEW_TOKENS       (imported, reused)
  * Gate A / Gate B logic          (untouched)
  * The model, NF4, LoRA settings  (loaded from the adapter/config as trained)
  * The chat-template inference format is reproduced EXACTLY as
    build_inference_prompt does (apply_chat_template + add_generation_prompt),
    only with the per-case held-out message substituted for the single fixed
    prompt. No new scoring criterion is introduced.

USAGE (run on a CUDA machine AFTER the E2 adapter has been trained):
    python scripts/evaluate_e2_held_out.py \
        --config configs/qwen3-4b-e2-validation.yaml \
        --adapter artifacts/qwen3-4b-e2-validation

This script does NOT train. It only loads an existing adapter and evaluates.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

# Frozen imports — used exactly as defined, never redefined here.
from ai_upchar_llm.config import load_config
from ai_upchar_llm.training.real_qlora import (
    CONTRACT_REQUIRED_KEYS,
    INFERENCE_MAX_NEW_TOKENS,
    INFERENCE_USER_MESSAGE,
    evaluate_contract_json,
)

# The instruction suffix that the frozen INFERENCE_USER_MESSAGE appends after
# the symptom text. We reproduce the SAME contract instruction so each held-out
# case is requested identically to how Gate B requests its single prompt. This
# is derived from the frozen INFERENCE_USER_MESSAGE and is not a new criterion.
#   INFERENCE_USER_MESSAGE == "<symptom>. " + CONTRACT_INSTRUCTION
_FIRST_SENTENCE = "Mujhe 5 din se headache hai. "
assert INFERENCE_USER_MESSAGE.startswith(_FIRST_SENTENCE), (
    "Frozen INFERENCE_USER_MESSAGE changed; harness must be re-derived to keep "
    "the held-out request identical to Gate B's request framing."
)
CONTRACT_INSTRUCTION = INFERENCE_USER_MESSAGE[len(_FIRST_SENTENCE) :]


def build_case_prompt(tokenizer, user_symptom_text: str) -> str:
    """Reproduce the EXACT formatting of the frozen build_inference_prompt, but
    for a per-case held-out user message. Same chat template, same
    add_generation_prompt=True, same contract instruction suffix. Only the
    symptom text differs. This does not alter or relax Gate B."""
    content = f"{user_symptom_text} {CONTRACT_INSTRUCTION}"
    messages = [{"role": "user", "content": content}]
    return tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)


def load_held_out(path: Path) -> list[dict]:
    """Load the 6 independent held-out records. Only the user message and
    metadata are used; the reference assistant output is NOT fed to the model."""
    records = []
    for line in path.read_text(encoding="utf-8").strip().split("\n"):
        if line.strip():
            records.append(json.loads(line))
    return records


def run_held_out_evaluation(config: dict, adapter_dir: Path) -> dict:
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    if not torch.cuda.is_available():
        raise RuntimeError("E2 held-out evaluation requires CUDA (same constraint as training).")

    model_name = os.environ.get("MODEL_NAME", config["model"]["name"])
    held_out_path = Path(config["data"]["evaluation_path"])
    cases = load_held_out(held_out_path)

    # Rebuild the SAME quantization used in training (read from config; unchanged).
    dtype = {"float16": torch.float16, "bfloat16": torch.bfloat16}[
        config["quantization"]["compute_dtype"]
    ]
    quantization = BitsAndBytesConfig(
        load_in_4bit=config["quantization"]["enabled"],
        bnb_4bit_quant_type=config["quantization"]["quant_type"],
        bnb_4bit_use_double_quant=config["quantization"]["double_quant"],
        bnb_4bit_compute_dtype=dtype,
    )

    tokenizer = AutoTokenizer.from_pretrained(
        model_name, cache_dir=os.environ.get("TRANSFORMERS_CACHE")
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    base = AutoModelForCausalLM.from_pretrained(
        model_name,
        cache_dir=os.environ.get("TRANSFORMERS_CACHE"),
        quantization_config=quantization,
        device_map="auto",
    )
    model = PeftModel.from_pretrained(base, str(adapter_dir))
    model.eval()

    per_case = []
    valid_count = 0
    for rec in cases:
        user_text = rec["messages"][0]["content"]
        prompt = build_case_prompt(tokenizer, user_text)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=INFERENCE_MAX_NEW_TOKENS,
                do_sample=False,
            )
        generated = tokenizer.decode(
            output_ids[0][inputs["input_ids"].shape[1] :],
            skip_special_tokens=True,
        ).strip()

        # FROZEN evaluator — called exactly as Gate B calls it.
        verdict = evaluate_contract_json(generated)
        if verdict["valid"]:
            valid_count += 1

        per_case.append(
            {
                "id": rec.get("id"),
                "language": rec.get("language"),
                "domain": rec.get("source", {}).get("domain"),
                "task_type": rec.get("task_type"),
                "user_input": user_text,
                "contract_valid": verdict["valid"],
                "reason": verdict.get("reason"),
                "missing_keys": verdict.get("missing_keys"),
                "generated_preview": generated[:300],
            }
        )

    total = len(cases)
    aggregate = {
        "evaluation_type": "E2_INDEPENDENT_HELD_OUT_CONTRACT",
        "note": (
            "This is a post-training generalization test on the 6 independent "
            "held-out cases using the frozen evaluate_contract_json. It is "
            "distinct from trainer.evaluate(), which reports loss on the "
            "internal 31-record split."
        ),
        "contract_required_keys": list(CONTRACT_REQUIRED_KEYS),
        "held_out_path": str(held_out_path),
        "adapter_path": str(adapter_dir),
        "base_model": model_name,
        "total_cases": total,
        "valid_cases": valid_count,
        "invalid_cases": total - valid_count,
        "contract_pass_rate": (valid_count / total) if total else 0.0,
        "per_case": per_case,
    }
    return aggregate


def main():
    parser = argparse.ArgumentParser(
        description="Additive E2 held-out contract evaluation (does not train)."
    )
    parser.add_argument(
        "--config",
        default="configs/qwen3-4b-e2-validation.yaml",
        help="E2 config; evaluation_path points to the 6 held-out cases.",
    )
    parser.add_argument(
        "--adapter",
        default=None,
        help="Path to trained E2 adapter (defaults to config training.output_dir).",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to write the JSON report.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    config["model"]["name"] = os.environ.get("MODEL_NAME", config["model"]["name"])
    adapter_dir = Path(args.adapter) if args.adapter else Path(config["training"]["output_dir"])

    if not adapter_dir.exists():
        raise SystemExit(
            f"Adapter directory not found: {adapter_dir}. Train the E2 adapter "
            f"first; this harness only evaluates an existing adapter."
        )

    report = run_held_out_evaluation(config, adapter_dir)

    print("=" * 72)
    print("E2 INDEPENDENT HELD-OUT CONTRACT EVALUATION")
    print("(distinct from trainer.evaluate() loss metric)")
    print("=" * 72)
    for case in report["per_case"]:
        status = "VALID" if case["contract_valid"] else "INVALID"
        print(f"\n[{status}] {case['id']} ({case['language']} / {case['domain']})")
        print(f"  Input: {case['user_input'][:70]}")
        if not case["contract_valid"]:
            print(f"  Reason: {case['reason']}")
            if case["missing_keys"]:
                print(f"  Missing keys: {case['missing_keys']}")
    print("\n" + "-" * 72)
    print(f"Total cases:  {report['total_cases']}")
    print(f"Valid:        {report['valid_cases']}")
    print(f"Invalid:      {report['invalid_cases']}")
    print(f"Pass rate:    {report['contract_pass_rate'] * 100:.1f}%")
    print("-" * 72)

    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nReport written to: {args.output}")


if __name__ == "__main__":
    main()
