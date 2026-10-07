"""E2 dataset validation + audit (authoring layer ONLY — no training, no Kaggle).

Validates the authored E2 SFT training set and the independent held-out set and
prints a full audit report. Reuses the restored ai_upchar_llm.data utilities and
the datasets loaders. Uses the FROZEN evaluator (evaluate_contract_json /
CONTRACT_REQUIRED_KEYS) READ-ONLY for the required-key check — it is never
modified.

Checks:
  - schema validation           (TrainingExample.validate via load_sft)
  - six-key schema validation    (all six approved keys present, correct types)
  - required-key validation       (frozen CONTRACT_REQUIRED_KEYS, read-only)
  - safety/consistency lint       (category-appropriate action/confidence)
  - no-fabrication check          (no invented vitals/labs/definitive diagnosis)
  - PII scan                      (deidentification.contains_direct_identifier)
  - duplicate / near-duplicate    (dedup.content_hash on inputs)
  - train/held-out leakage        (input content-hash overlap)

Nothing is written; this only reads the two E2 files and reports.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

from ai_upchar_llm.data.dedup import content_hash
from ai_upchar_llm.data.deidentification import contains_direct_identifier
from ai_upchar_llm.datasets.sft_dataset import load_sft

# FROZEN evaluator — imported and used read-only. Never modified here.
from ai_upchar_llm.training.real_qlora import CONTRACT_REQUIRED_KEYS, evaluate_contract_json

SIX_KEYS = [
    "semantic_interpretation",
    "recommended_action",
    "next_best_question",
    "missing_information",
    "clinical_considerations",
    "confidence",
]
VALID_CONFIDENCE = {"low", "moderate", "high", None}
RED_FLAG_ACTIONS = {"SAFETY_REVIEW"}
BOUNDARY_ACTIONS = {"DECLINE_REDIRECT", "REFER_ROUTINE"}
# Patterns that would indicate a fabricated objective finding (vitals / labs /
# definitive diagnosis) not supportable from a patient's free-text report.
FABRICATION_PATTERNS = [
    re.compile(r"\b\d{2,3}/\d{2,3}\s*mmHg\b", re.I),  # BP reading
    re.compile(r"\b\d{2,3}\s*bpm\b", re.I),  # heart rate
    re.compile(r"\bSpO2\b|\bspo2\b"),  # oxygen sat
    re.compile(r"\bHbA1c\b", re.I),
    re.compile(r"\b\d+(\.\d+)?\s*(mg/dl|mmol/l)\b", re.I),  # lab value
    re.compile(r"\bconfirmed (diagnosis|case) of\b", re.I),  # definitive dx
    re.compile(r"\byou are diagnosed with\b", re.I),
    # assert-style "you have <dx>" but NOT interrogative "do you have ...?"
    re.compile(
        r"(?<!do )(?<!does )\byou (?:have|are having) (?:a |an )?[a-z]+(?:itis|emia|osis|pathy|infarction|stroke|cancer)\b",
        re.I,
    ),
]


def _fabrication_hits(assistant_json_text: str, parsed: dict) -> bool:
    """Flag fabricated objective findings. Only scans the model-authored value
    fields where an invented vital/lab/diagnosis would live; skips
    next_best_question (which legitimately asks 'do you have ...')."""
    scan = " ".join(
        [
            json.dumps(parsed.get("semantic_interpretation", {}), ensure_ascii=False),
            " ".join(parsed.get("clinical_considerations", []) or []),
            " ".join(parsed.get("missing_information", []) or []),
        ]
    )
    return any(p.search(scan) for p in FABRICATION_PATTERNS)


def load_raw(path: Path) -> list[dict]:
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def category_of(example_id: str) -> str:
    # ids look like e2-com-001 / e2-red-001 / e2-amb-001 / e2-bou-001 / e2-ho-...-001
    m = re.match(r"e2-(ho-)?([a-z]+)", example_id)
    key = m.group(2) if m else "unknown"
    return {"com": "common", "red": "redflag", "amb": "ambiguous", "bou": "boundary"}.get(key, key)


def audit(train_path: Path, held_path: Path) -> dict:
    report: dict = {"rejections": []}

    # ---- schema validation (raises if any record is structurally invalid) ----
    try:
        load_sft(train_path)
        load_sft(held_path)
        report["schema_validation"] = "PASS (all records conform to TrainingExample)"
    except Exception as exc:  # noqa: BLE001
        report["schema_validation"] = f"FAIL: {exc}"
        return report

    train_raw = load_raw(train_path)
    held_raw = load_raw(held_path)
    report["train_count"] = len(train_raw)
    report["held_out_count"] = len(held_raw)
    report["total_count"] = len(train_raw) + len(held_raw)

    # ---- distributions (training set) ----
    cats = Counter(category_of(r["id"]) for r in train_raw)
    langs = Counter(r["language"] for r in train_raw)
    domains = Counter(r["source"]["domain"] for r in train_raw)
    report["category_distribution"] = dict(cats)
    report["language_distribution"] = dict(langs)
    report["clinical_domain_distribution"] = dict(sorted(domains.items()))
    report["held_out_category_distribution"] = dict(Counter(category_of(r["id"]) for r in held_raw))
    report["held_out_language_distribution"] = dict(Counter(r["language"] for r in held_raw))

    six_ok = req_ok = safety_ok = fabrication_ok = pii_ok = 0
    all_records = [("train", r) for r in train_raw] + [("held", r) for r in held_raw]

    for split, r in all_records:
        rid = r["id"]
        user_text = r["messages"][0]["content"]
        assistant_text = r["messages"][1]["content"]

        # PII scan (input + output)
        if contains_direct_identifier(user_text) or contains_direct_identifier(assistant_text):
            report["rejections"].append({"id": rid, "reason": "PII detected"})
        else:
            pii_ok += 1

        # parse assistant JSON
        try:
            parsed = json.loads(assistant_text)
        except Exception:
            report["rejections"].append({"id": rid, "reason": "assistant content not valid JSON"})
            continue

        # six-key schema
        missing_keys = [k for k in SIX_KEYS if k not in parsed]
        types_ok = (
            isinstance(parsed.get("semantic_interpretation"), dict)
            and isinstance(parsed.get("recommended_action"), str)
            and isinstance(parsed.get("next_best_question"), str)
            and isinstance(parsed.get("missing_information"), list)
            and isinstance(parsed.get("clinical_considerations"), list)
            and parsed.get("confidence") in VALID_CONFIDENCE
        )
        if missing_keys or not types_ok:
            report["rejections"].append(
                {
                    "id": rid,
                    "reason": f"six-key schema issue: missing={missing_keys} types_ok={types_ok}",
                }
            )
        else:
            six_ok += 1

        # required-key via FROZEN evaluator (read-only)
        verdict = evaluate_contract_json(assistant_text)
        if verdict["valid"]:
            req_ok += 1
        else:
            report["rejections"].append(
                {
                    "id": rid,
                    "reason": f"frozen evaluator: {verdict.get('reason')} {verdict.get('missing_keys')}",
                }
            )

        # safety/consistency lint
        cat = category_of(rid)
        action = parsed.get("recommended_action")
        conf = parsed.get("confidence")
        ok = True
        if cat == "redflag" and action not in RED_FLAG_ACTIONS:
            ok = False
        if cat == "boundary" and action not in BOUNDARY_ACTIONS:
            ok = False
        if cat == "ambiguous" and (
            parsed.get("missing_information") == [] and action not in {"CLARIFY", "ASK_QUESTION"}
        ):
            ok = False
        if cat == "ambiguous" and conf not in {"low", None}:
            ok = False
        if ok:
            safety_ok += 1
        else:
            report["rejections"].append(
                {"id": rid, "reason": f"safety/consistency: cat={cat} action={action} conf={conf}"}
            )

        # no-fabrication (scan only value fields where a finding would be invented)
        if _fabrication_hits(assistant_text, parsed):
            report["rejections"].append(
                {"id": rid, "reason": "possible fabricated vital/lab/diagnosis"}
            )
        else:
            fabrication_ok += 1

    n = len(all_records)
    report["six_key_schema_validation"] = f"{six_ok}/{n} passed"
    report["required_key_validation"] = (
        f"{req_ok}/{n} passed (frozen CONTRACT_REQUIRED_KEYS={list(CONTRACT_REQUIRED_KEYS)})"
    )
    report["safety_consistency_validation"] = f"{safety_ok}/{n} passed"
    report["no_fabrication_validation"] = f"{fabrication_ok}/{n} passed"
    report["pii_scan"] = f"{pii_ok}/{n} clean"

    # ---- dedup (within training inputs) ----
    train_inputs = [r["messages"][0]["content"] for r in train_raw]
    train_hashes = [content_hash(t) for t in train_inputs]
    dup_within = len(train_hashes) - len(set(train_hashes))
    report["duplicate_within_train"] = dup_within
    # id uniqueness
    all_ids = [r["id"] for r in train_raw + held_raw]
    report["duplicate_ids"] = len(all_ids) - len(set(all_ids))

    # ---- train/held-out leakage (input content-hash overlap) ----
    held_hashes = {content_hash(r["messages"][0]["content"]) for r in held_raw}
    overlap = held_hashes & set(train_hashes)
    report["train_held_out_leakage"] = f"{len(overlap)} overlapping input hashes"

    # ---- final training-step budget (from ACTUAL final counts; max_steps NOT changed) ----
    train_n = len(train_raw)
    eff_batch = 1 * 2  # per_device_train_batch_size * gradient_accumulation_steps (frozen)
    steps_per_epoch = -(-train_n // eff_batch)  # ceil
    report["training_step_budget"] = {
        "note": "Derived from actual final dataset size. max_steps is NOT modified by this task.",
        "train_examples": train_n,
        "effective_batch_per_step": eff_batch,
        "steps_per_epoch": steps_per_epoch,
        "epochs_3": steps_per_epoch * 3,
        "epochs_4": steps_per_epoch * 4,
        "current_frozen_max_steps": 2,
    }
    return report


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", default=str(root / "data" / "sft" / "e2_contract_sft.jsonl"))
    ap.add_argument(
        "--held", default=str(root / "data" / "evaluation" / "e2_held_out_contract.jsonl")
    )
    args = ap.parse_args()
    print(json.dumps(audit(Path(args.train), Path(args.held)), indent=2, ensure_ascii=False))
