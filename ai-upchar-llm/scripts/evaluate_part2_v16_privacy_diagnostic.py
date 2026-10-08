from __future__ import annotations

import argparse
import json
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path
from typing import Any

from evaluate_part2_v12_focused import generate_record, load_records
from structured_json_generation import STRUCTURED_DECODING_IMPLEMENTATION


PRIVACY_KEYS = (
    "privacy_action",
    "data_minimization",
    "response_rule",
    "clinical_focus",
)
FROZEN_E20_TOTAL = 30
FROZEN_E20_UNIQUE_PROMPTS = 24


def select_privacy_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected = []
    for record in records:
        expected = json.loads(record["messages"][-1]["content"])
        if tuple(expected) == PRIVACY_KEYS:
            selected.append(record)
    if len(selected) != FROZEN_E20_TOTAL:
        raise ValueError(f"Frozen E20 contract changed: {len(selected)} != {FROZEN_E20_TOTAL}")
    return selected


def group_deterministic_prompts(
    records: list[dict[str, Any]],
) -> list[list[dict[str, Any]]]:
    groups: OrderedDict[tuple[str, str], list[dict[str, Any]]] = OrderedDict()
    for record in records:
        user = next(
            message["content"] for message in record["messages"] if message["role"] == "user"
        )
        expected = record["messages"][-1]["content"]
        groups.setdefault((user, expected), []).append(record)
    grouped = list(groups.values())
    if len(grouped) != FROZEN_E20_UNIQUE_PROMPTS:
        raise ValueError(
            f"Frozen E20 unique prompt count changed: {len(grouped)} != {FROZEN_E20_UNIQUE_PROMPTS}"
        )
    return grouped


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-4B-Base")
    parser.add_argument("--part2-heldout", default="data/evaluation/part2_advanced_held_out.jsonl")
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

    privacy_records = select_privacy_records(load_records(args.part2_heldout))
    groups = group_deterministic_prompts(privacy_records)
    unique_results = []
    expanded_results = []
    for index, group in enumerate(groups, start=1):
        representative = group[0]
        result = generate_record(model, tokenizer, representative)
        covered_ids = [record["id"] for record in group]
        unique_results.append({**result, "covered_ids": covered_ids})
        for record_id in covered_ids:
            expanded = deepcopy(result)
            expanded["id"] = record_id
            expanded["representative_id"] = representative["id"]
            expanded_results.append(expanded)
        print(
            f"E20 unique progress: {index}/{len(groups)} "
            f"id={representative['id']} passed={result['passed']}",
            flush=True,
        )

    status = (
        "PASS"
        if (
            len(expanded_results) == FROZEN_E20_TOTAL
            and all(result["passed"] for result in unique_results)
        )
        else "FAIL"
    )
    report = {
        "status": status,
        "structured_decoding": STRUCTURED_DECODING_IMPLEMENTATION,
        "frozen_total": len(expanded_results),
        "unique_prompts_generated": len(unique_results),
        "passed_frozen": sum(int(item["passed"]) for item in expanded_results),
        "passed_unique": sum(int(item["passed"]) for item in unique_results),
        "unique_results": unique_results,
        "results": expanded_results,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "status": status,
                "passed_frozen": f"{report['passed_frozen']}/{report['frozen_total']}",
                "passed_unique": f"{report['passed_unique']}/{report['unique_prompts_generated']}",
            },
            indent=2,
        ),
        flush=True,
    )
    if status != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
