from __future__ import annotations

import argparse
import hashlib
import json
import statistics
from pathlib import Path
from typing import Any

from transformers import AutoTokenizer

from structured_json_generation import (
    STRUCTURED_DECODING_IMPLEMENTATION,
    build_ordered_json_parser,
)


def parser_accepts(expected: dict[str, Any], text: str, alphabet: str) -> bool:
    parser = build_ordered_json_parser(expected, alphabet=alphabet)
    for character in text:
        if character not in parser.get_allowed_characters():
            return False
        parser = parser.add_character(character)
    return parser.can_end()


def load_records(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def percentile(values: list[int], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--dataset", action="append", required=True)
    parser.add_argument("--failure-report", required=True)
    parser.add_argument("--structured-failure-report", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.tokenizer, local_files_only=True)
    records = [
        record
        for dataset in args.dataset
        for record in load_records(Path(dataset))
    ]
    failure_report = json.loads(Path(args.failure_report).read_text(encoding="utf-8"))
    structured_failure_report = json.loads(
        Path(args.structured_failure_report).read_text(encoding="utf-8")
    )
    previous_outputs = [item["output"] for item in failure_report["part2"]["results"]]
    structured_outputs = [item["output"] for item in structured_failure_report["results"]]
    alphabet = "".join(
        sorted(
            set(
                "".join(
                    [
                        *(record["messages"][-1]["content"] for record in records),
                        *previous_outputs,
                        *structured_outputs,
                    ]
                )
            )
        )
    )
    token_lengths: list[int] = []
    expected_failures: list[dict[str, Any]] = []
    roundtrip_failures: list[str] = []
    for record in records:
        raw = record["messages"][-1]["content"]
        expected = json.loads(raw)
        compact = json.dumps(expected, ensure_ascii=False, separators=(",", ":"))
        if not parser_accepts(expected, compact, alphabet):
            expected_failures.append({"id": record.get("id"), "reason": "parser_rejected"})
        token_ids = tokenizer.encode(raw, add_special_tokens=False)
        token_lengths.append(len(token_ids))
        if tokenizer.decode(token_ids, skip_special_tokens=False) != raw:
            roundtrip_failures.append(str(record.get("id")))

    malformed = [
        item
        for item in failure_report["part2"]["results"]
        if not item["json_valid"]
    ]
    malformed_checks: list[dict[str, Any]] = []
    by_id = {record.get("id"): record for record in records}
    for item in malformed:
        expected = json.loads(by_id[item["id"]]["messages"][-1]["content"])
        malformed_checks.append(
            {
                "id": item["id"],
                "parser_rejects": not parser_accepts(expected, item["output"], alphabet),
                "error": item["error"],
            }
        )

    structured_checks: list[dict[str, Any]] = []
    for item in structured_failure_report["results"]:
        expected = json.loads(by_id[item["id"]]["messages"][-1]["content"])
        accepted = parser_accepts(expected, item["output"], alphabet)
        structured_checks.append(
            {
                "id": item["id"],
                "previously_passed": bool(item["passed"]),
                "parser_accepts": accepted,
                "consistent": accepted == bool(item["passed"]),
            }
        )

    template = tokenizer.chat_template or ""
    report = {
        "status": "PASS" if (
            len(records) == 413
            and not expected_failures
            and not roundtrip_failures
            and len(malformed_checks) == 3
            and all(item["parser_rejects"] for item in malformed_checks)
            and len(structured_checks) == 2
            and all(item["consistent"] for item in structured_checks)
        ) else "FAIL",
        "structured_decoding": STRUCTURED_DECODING_IMPLEMENTATION,
        "tokenizer_class": type(tokenizer).__name__,
        "tokenizer_source": str(Path(args.tokenizer).resolve()),
        "vocab_size": len(tokenizer),
        "eos_token": tokenizer.eos_token,
        "eos_token_id": tokenizer.eos_token_id,
        "chat_template_sha256": hashlib.sha256(template.encode("utf-8")).hexdigest(),
        "records": len(records),
        "datasets": args.dataset,
        "expected_parser_failures": expected_failures,
        "tokenizer_roundtrip_failures": roundtrip_failures,
        "assistant_token_lengths": {
            "min": min(token_lengths),
            "max": max(token_lengths),
            "mean": statistics.mean(token_lengths),
            "median": statistics.median(token_lengths),
            "p95": percentile(token_lengths, 0.95),
            "p99": percentile(token_lengths, 0.99),
        },
        "previous_malformed_outputs": malformed_checks,
        "v2_structured_output_replay": structured_checks,
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
