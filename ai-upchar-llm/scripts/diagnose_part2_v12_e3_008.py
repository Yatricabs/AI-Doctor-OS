from __future__ import annotations

import argparse
import json
from pathlib import Path

from evaluate_e3_safety import build_prompt, check_clinical_safety, evaluate_contract


def load_case(path: Path, case_id: str) -> dict:
    records = [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]
    matches = [record for record in records if record.get("id") == case_id]
    if len(matches) != 1:
        raise ValueError(f"Expected one {case_id} record, found {len(matches)}")
    return matches[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-4B-Base")
    parser.add_argument("--e3-heldout", default="data/evaluation/e3_targeted_safety_heldout.jsonl")
    parser.add_argument("--case-id", default="e3-ho-008")
    args = parser.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    record = load_case(Path(args.e3_heldout), args.case_id)
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

    user_text = next(
        message["content"] for message in record["messages"] if message["role"] == "user"
    )
    prompt = build_prompt(tokenizer, user_text)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    im_end = tokenizer.convert_tokens_to_ids("<|im_end|>")
    eos_ids = [tokenizer.eos_token_id, im_end]
    runs = []
    settings = (
        ("baseline", {}),
        ("repetition_penalty_1_05", {"repetition_penalty": 1.05}),
        ("repetition_penalty_1_10", {"repetition_penalty": 1.10}),
        ("no_repeat_ngram_3", {"no_repeat_ngram_size": 3}),
        (
            "repetition_penalty_1_05_no_repeat_ngram_3",
            {"repetition_penalty": 1.05, "no_repeat_ngram_size": 3},
        ),
    )
    for name, generation_settings in settings:
        with torch.no_grad():
            generated = model.generate(
                **inputs,
                max_new_tokens=512,
                do_sample=False,
                eos_token_id=eos_ids,
                **generation_settings,
            )[0][inputs["input_ids"].shape[1] :]
        token_ids = generated.tolist()
        raw = tokenizer.decode(generated, skip_special_tokens=True).strip()
        contract = evaluate_contract(raw)
        runs.append(
            {
                "setting": name,
                "generation_settings": generation_settings,
                "max_new_tokens": 512,
                "generated_tokens": len(token_ids),
                "last_token_id": token_ids[-1] if token_ids else None,
                "stopped_on_eos": bool(token_ids and token_ids[-1] in eos_ids),
                "contract": contract,
                "safety_violations": (
                    check_clinical_safety(contract["parsed"]) if contract["valid"] else []
                ),
                "raw": raw,
            }
        )

    report = {
        "status": "PASS" if any(run["contract"]["valid"] for run in runs) else "FAIL",
        "case_id": args.case_id,
        "prompt_tokens": int(inputs["input_ids"].shape[1]),
        "eos_token_ids": eos_ids,
        "runs": runs,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
