from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from evaluate_part2_v12_focused import generate_record, load_records
from evaluate_part2_v12_full import normalized_user
from structured_json_generation import STRUCTURED_DECODING_IMPLEMENTATION


UNIQUE_FAILURE_IDS = ("E17-heldout-0013", "E20-heldout-0001")
DUPLICATE_FAILURE_ID = "E20-heldout-0025"


def select_unique_failures(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {record.get("id"): record for record in records}
    required = {*UNIQUE_FAILURE_IDS, DUPLICATE_FAILURE_ID}
    missing = sorted(required - set(by_id))
    if missing:
        raise ValueError(f"Missing frozen V16 failure probes: {missing}")
    if normalized_user(by_id["E20-heldout-0001"]) != normalized_user(
        by_id[DUPLICATE_FAILURE_ID]
    ):
        raise ValueError("Expected E20-heldout-0025 to duplicate E20-heldout-0001")
    return [by_id[record_id] for record_id in UNIQUE_FAILURE_IDS]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-4B-Base")
    parser.add_argument(
        "--part2-heldout", default="data/evaluation/part2_advanced_held_out.jsonl"
    )
    args = parser.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

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
        device_map={"": 0},
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, args.adapter)
    model.eval()

    results = [
        generate_record(model, tokenizer, record)
        for record in select_unique_failures(load_records(args.part2_heldout))
    ]
    status = "PASS" if all(result["passed"] for result in results) else "FAIL"
    report = {
        "status": status,
        "structured_decoding": STRUCTURED_DECODING_IMPLEMENTATION,
        "unique_failure_prompts": len(results),
        "covered_failure_ids": [*UNIQUE_FAILURE_IDS, DUPLICATE_FAILURE_ID],
        "results": results,
    }
    Path(args.output).write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    if status != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
