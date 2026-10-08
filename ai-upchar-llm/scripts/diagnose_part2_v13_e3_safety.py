from __future__ import annotations

import argparse
import json
from pathlib import Path

from evaluate_e3_safety import build_prompt, check_clinical_safety, evaluate_contract


def load_cases(path: Path, case_ids: set[str]) -> list[dict]:
    records = [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]
    selected = [record for record in records if record.get("id") in case_ids]
    if {record.get("id") for record in selected} != case_ids:
        raise ValueError(
            f"Expected cases {sorted(case_ids)}, found {[record.get('id') for record in selected]}"
        )
    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-4B-Base")
    parser.add_argument("--e3-heldout", default="data/evaluation/e3_targeted_safety_heldout.jsonl")
    parser.add_argument("--all-e3", action="store_true")
    args = parser.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    case_ids = (
        {
            "e3-ho-001",
            "e3-ho-002",
            "e3-ho-003",
            "e3-ho-004",
            "e3-ho-005",
            "e3-ho-006",
            "e3-ho-007",
            "e3-ho-008",
            "e3-ho-009",
            "e3-ho-010",
            "e3-ho-011",
            "e3-ho-012",
        }
        if args.all_e3
        else {"e3-ho-003", "e3-ho-008"}
    )
    cases = load_cases(Path(args.e3_heldout), case_ids)
    tokenizer = AutoTokenizer.from_pretrained(args.adapter, trust_remote_code=True)
    quant = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )
    base = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=quant,
        device_map="auto",
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, args.adapter)
    model.eval()

    im_end = tokenizer.convert_tokens_to_ids("<|im_end|>")
    eos_ids = [tokenizer.eos_token_id, im_end]
    settings = (
        ("gate_c_baseline", {"max_new_tokens": 256}),
        ("longer_generation", {"max_new_tokens": 512}),
        ("repetition_penalty_1_05", {"max_new_tokens": 512, "repetition_penalty": 1.05}),
        ("repetition_penalty_1_10", {"max_new_tokens": 512, "repetition_penalty": 1.10}),
    )
    runs = []
    for record in cases:
        user_text = next(
            message["content"] for message in record["messages"] if message["role"] == "user"
        )
        prompt = build_prompt(tokenizer, user_text)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        for name, generation_settings in settings:
            with torch.no_grad():
                generated = model.generate(
                    **inputs,
                    do_sample=False,
                    eos_token_id=eos_ids,
                    **generation_settings,
                )[0][inputs["input_ids"].shape[1] :]
            token_ids = generated.tolist()
            raw = tokenizer.decode(generated, skip_special_tokens=True).strip()
            contract = evaluate_contract(raw)
            violations = check_clinical_safety(contract["parsed"]) if contract["valid"] else []
            runs.append(
                {
                    "case_id": record["id"],
                    "setting": name,
                    "generation_settings": generation_settings,
                    "generated_tokens": len(token_ids),
                    "last_token_id": token_ids[-1] if token_ids else None,
                    "stopped_on_eos": bool(token_ids and token_ids[-1] in eos_ids),
                    "contract": contract,
                    "safety_violations": violations,
                    "raw": raw,
                }
            )

    report = {
        "status": "PASS"
        if all(
            run["contract"]["valid"] and not run["safety_violations"]
            for run in runs
            if run["setting"] != "gate_c_baseline"
        )
        else "FAIL",
        "cases": [record["id"] for record in cases],
        "eos_token_ids": eos_ids,
        "runs": runs,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
