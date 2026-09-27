"""E3 targeted clinical safety dataset QA and validation suite.

Runs full static, schema, integrity, safety, privacy, and distribution audits
on:
  - E3 train set: data/sft/e3_targeted_safety_train.jsonl
  - E3 held-out set: data/evaluation/e3_targeted_safety_heldout.jsonl
Against:
  - Frozen E2 train set: data/sft/e2_contract_sft.jsonl
  - Frozen E2 held-out set: data/evaluation/e2_held_out_contract.jsonl
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

SIX_KEYS = {
    "semantic_interpretation",
    "recommended_action",
    "next_best_question",
    "missing_information",
    "clinical_considerations",
    "confidence",
}

VALID_CONFIDENCE = {"low", "moderate", "high"}

CATEGORIES = [
    "acute_chest_pain",
    "hemoptysis",
    "sudden_unresponsiveness",
    "gi_bleeding",
    "pelvic_pain",
    "generalized_pain",
]

# Clinical safety rules: patterns that indicate boundary violations or overreach
BANNED_SAFETY_PATTERNS = [
    (re.compile(r"\b(do|perform|schedule|order|get)\s+(an?\s+)?(ecg|ekg|cardiac enzymes|troponin)\b", re.I), "premature ECG/enzymes prescribing"),
    (re.compile(r"\b(do|perform|schedule|order)\s+(an?\s+)?(endoscopy|colonoscopy|biopsy|ct scan|mri)\b", re.I), "premature procedure/scan selection"),
    (re.compile(r"\brefer\s+to\s+(a\s+)?(cardiologist|cardiology)\b", re.I), "inappropriate cardiology redirection"),
    (re.compile(r"\brefer\s+to\s+(an?\s+)?(ent|otolaryngolog\w+)\b", re.I), "inappropriate ENT redirection"),
    (re.compile(r"\bstart\s+cpr\b", re.I), "unconditional CPR instruction before checking breathing/responsiveness"),
    (re.compile(r"\bconfirmed\s+(diagnosis|case)\s+of\b", re.I), "definitive diagnosis overclaiming"),
    (re.compile(r"\byou\s+are\s+diagnosed\s+with\b", re.I), "direct diagnosis statement"),
    (re.compile(r"\btake\s+\d+\s*(mg|ml|tablets?)\b", re.I), "medication dose prescribing"),
]

# Privacy / PII patterns
PII_PATTERNS = [
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "email address"),
    (re.compile(r"\b(?:\+?91[\-\s]?)?[6-9]\d{9}\b"), "phone number (+91 or 10-digit mobile)"),
    (re.compile(r"\b\d{4}\s*\d{4}\s*\d{4}\b"), "12-digit Aadhaar pattern"),
]


def content_hash(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip().lower())
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def tokenize(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower()))


def jaccard_similarity(s1: str, s2: str) -> float:
    t1 = tokenize(s1)
    t2 = tokenize(s2)
    if not t1 or not t2:
        return 0.0
    return len(t1 & t2) / len(t1 | t2)


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    records = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except Exception as e:
                raise ValueError(f"Line {line_no} in {path.name} is not valid JSON: {e}")
    return records


DOMAIN_TO_CATEGORY = {
    "cardiac": "acute_chest_pain",
    "respiratory": "hemoptysis",
    "neuro": "sudden_unresponsiveness",
    "gastrointestinal": "gi_bleeding",
    "gynecology": "pelvic_pain",
    "general": "generalized_pain",
}


def get_category_from_record(record: dict) -> str:
    domain = record.get("source", {}).get("domain", "")
    return DOMAIN_TO_CATEGORY.get(domain, "other")


def audit_e3(
    e3_train_path: Path,
    e3_heldout_path: Path,
    e2_train_path: Path | None = None,
    e2_heldout_path: Path | None = None,
) -> dict:
    report: dict = {
        "status": "PASS",
        "errors": [],
        "warnings": [],
        "metrics": {},
    }

    # 1. Load files
    train_records = load_jsonl(e3_train_path)
    heldout_records = load_jsonl(e3_heldout_path)
    report["metrics"]["train_count"] = len(train_records)
    report["metrics"]["heldout_count"] = len(heldout_records)

    e2_train = load_jsonl(e2_train_path) if e2_train_path and e2_train_path.exists() else []
    e2_heldout = load_jsonl(e2_heldout_path) if e2_heldout_path and e2_heldout_path.exists() else []

    all_e3 = [("e3_train", r) for r in train_records] + [("e3_heldout", r) for r in heldout_records]

    # 2. Schema and Field Validation
    expected_top_keys = {"id", "task_type", "language", "messages", "source", "privacy"}
    for split, r in all_e3:
        rid = r.get("id", "UNKNOWN")
        # Check top-level keys
        missing_top = expected_top_keys - set(r.keys())
        if missing_top:
            report["errors"].append(f"[{split} {rid}] Missing record keys: {missing_top}")

        # Check messages structure
        messages = r.get("messages", [])
        if len(messages) != 2:
            report["errors"].append(f"[{split} {rid}] Expected exactly 2 messages, got {len(messages)}")
            continue
        if messages[0].get("role") != "user":
            report["errors"].append(f"[{split} {rid}] First message must have role 'user'")
        if messages[1].get("role") != "assistant":
            report["errors"].append(f"[{split} {rid}] Second message must have role 'assistant'")

        user_content = messages[0].get("content", "")
        asst_content = messages[1].get("content", "")

        if not user_content.strip():
            report["errors"].append(f"[{split} {rid}] User content is empty")

        # Parse assistant JSON
        try:
            parsed = json.loads(asst_content)
        except Exception as e:
            report["errors"].append(f"[{split} {rid}] Assistant content is not valid JSON: {e}")
            continue

        if not isinstance(parsed, dict):
            report["errors"].append(f"[{split} {rid}] Assistant JSON is not an object")
            continue

        # Check six contract keys
        asst_keys = set(parsed.keys())
        missing_contract = SIX_KEYS - asst_keys
        extra_contract = asst_keys - SIX_KEYS
        if missing_contract:
            report["errors"].append(f"[{split} {rid}] Missing contract keys: {missing_contract}")
        if extra_contract:
            report["errors"].append(f"[{split} {rid}] Unexpected extra contract keys: {extra_contract}")

        # Check types
        if not isinstance(parsed.get("semantic_interpretation"), dict):
            report["errors"].append(f"[{split} {rid}] 'semantic_interpretation' must be dict")
        if not isinstance(parsed.get("recommended_action"), str):
            report["errors"].append(f"[{split} {rid}] 'recommended_action' must be str")
        if not isinstance(parsed.get("next_best_question"), str):
            report["errors"].append(f"[{split} {rid}] 'next_best_question' must be str")
        if not isinstance(parsed.get("missing_information"), list):
            report["errors"].append(f"[{split} {rid}] 'missing_information' must be list")
        if not isinstance(parsed.get("clinical_considerations"), list):
            report["errors"].append(f"[{split} {rid}] 'clinical_considerations' must be list")
        if parsed.get("confidence") not in VALID_CONFIDENCE:
            report["errors"].append(f"[{split} {rid}] Invalid confidence '{parsed.get('confidence')}'; expected one of {VALID_CONFIDENCE}")

        # 3. Clinical Safety & Boundary Audit
        scan_text = f"{parsed.get('recommended_action', '')} {' '.join(parsed.get('clinical_considerations', []))} {parsed.get('next_best_question', '')}"
        for pat, desc in BANNED_SAFETY_PATTERNS:
            if pat.search(scan_text):
                report["errors"].append(f"[{split} {rid}] Safety boundary violation: {desc}")

        # 4. PII Audit
        full_text = f"{user_content} {asst_content}"
        for pat, desc in PII_PATTERNS:
            if pat.search(full_text):
                report["errors"].append(f"[{split} {rid}] Potential PII detected: {desc}")

    # 5. Integrity & Duplicate Audits
    e3_train_ids = [r["id"] for r in train_records]
    e3_heldout_ids = [r["id"] for r in heldout_records]
    all_e3_ids = e3_train_ids + e3_heldout_ids

    # ID uniqueness
    id_counts = Counter(all_e3_ids)
    dup_ids = [i for i, c in id_counts.items() if c > 1]
    if dup_ids:
        report["errors"].append(f"Duplicate IDs found in E3: {dup_ids}")

    # Check ID collision with E2
    e2_ids = {r["id"] for r in e2_train + e2_heldout}
    e3_e2_id_overlap = set(all_e3_ids) & e2_ids
    if e3_e2_id_overlap:
        report["errors"].append(f"ID collision with E2 baseline: {e3_e2_id_overlap}")

    # Exact content hash duplicates
    train_hashes = [content_hash(r["messages"][0]["content"]) for r in train_records]
    heldout_hashes = [content_hash(r["messages"][0]["content"]) for r in heldout_records]

    dup_train_hashes = [h for h, c in Counter(train_hashes).items() if c > 1]
    if dup_train_hashes:
        report["errors"].append(f"Exact duplicate user inputs within E3 train: {len(dup_train_hashes)}")

    dup_heldout_hashes = [h for h, c in Counter(heldout_hashes).items() if c > 1]
    if dup_heldout_hashes:
        report["errors"].append(f"Exact duplicate user inputs within E3 heldout: {len(dup_heldout_hashes)}")

    # Train <-> Heldout leakage
    leakage = set(train_hashes) & set(heldout_hashes)
    if leakage:
        report["errors"].append(f"Critical leakage: E3 train and E3 held-out share {len(leakage)} exact inputs!")

    # E3 <-> E2 leakage
    e2_train_hashes = {content_hash(r["messages"][0]["content"]) for r in e2_train}
    e2_heldout_hashes = {content_hash(r["messages"][0]["content"]) for r in e2_heldout}

    e3_train_e2_train_leak = set(train_hashes) & e2_train_hashes
    if e3_train_e2_train_leak:
        report["errors"].append(f"Leakage: E3 train shares {len(e3_train_e2_train_leak)} exact inputs with E2 train!")

    e3_held_e2_held_leak = set(heldout_hashes) & e2_heldout_hashes
    if e3_held_e2_held_leak:
        report["errors"].append(f"Leakage: E3 heldout shares {len(e3_held_e2_held_leak)} exact inputs with E2 heldout!")

    # Near-duplicate check between train and held-out (Jaccard > 0.85)
    for tr in train_records:
        t_text = tr["messages"][0]["content"]
        for ho in heldout_records:
            h_text = ho["messages"][0]["content"]
            sim = jaccard_similarity(t_text, h_text)
            if sim > 0.85:
                report["warnings"].append(f"High lexical similarity ({sim:.2f}) between train {tr['id']} and heldout {ho['id']}")

    # 6. Coverage & Distributions
    train_langs = Counter(r.get("language") for r in train_records)
    held_langs = Counter(r.get("language") for r in heldout_records)
    report["metrics"]["train_language_distribution"] = dict(train_langs)
    report["metrics"]["heldout_language_distribution"] = dict(held_langs)

    train_cats = Counter(get_category_from_record(r) for r in train_records)
    held_cats = Counter(get_category_from_record(r) for r in heldout_records)
    report["metrics"]["train_category_distribution"] = dict(train_cats)
    report["metrics"]["heldout_category_distribution"] = dict(held_cats)

    # Validate minimum coverage constraints:
    # At least 24 train examples
    if len(train_records) < 24:
        report["errors"].append(f"Train dataset size {len(train_records)} < 24 minimum")
    # At least 12 heldout examples
    if len(heldout_records) < 12:
        report["errors"].append(f"Held-out dataset size {len(heldout_records)} < 12 minimum")

    # At least 4 per category in train
    for cat in CATEGORIES:
        if train_cats.get(cat, 0) < 4:
            report["errors"].append(f"Train category '{cat}' count {train_cats.get(cat, 0)} < 4 required minimum")
        if held_cats.get(cat, 0) < 2:
            report["errors"].append(f"Held-out category '{cat}' count {held_cats.get(cat, 0)} < 2 required minimum")

    if report["errors"]:
        report["status"] = "FAIL"

    return report


def main() -> None:
    train_path = DATA_DIR / "sft" / "e3_targeted_safety_train.jsonl"
    held_path = DATA_DIR / "evaluation" / "e3_targeted_safety_heldout.jsonl"
    e2_train_path = DATA_DIR / "sft" / "e2_contract_sft.jsonl"
    e2_held_path = DATA_DIR / "evaluation" / "e2_held_out_contract.jsonl"

    res = audit_e3(train_path, held_path, e2_train_path, e2_held_path)
    print(json.dumps(res, indent=2, ensure_ascii=False))

    if res["status"] != "PASS":
        print(f"\n[FAIL] E3 Dataset QA Failed with {len(res['errors'])} errors!")
        sys.exit(1)
    else:
        print("\n[OK] E3 Dataset QA Passed with ZERO errors!")


if __name__ == "__main__":
    main()
