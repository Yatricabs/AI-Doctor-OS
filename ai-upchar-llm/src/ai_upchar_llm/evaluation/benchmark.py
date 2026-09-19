import json
from pathlib import Path


def load_benchmark(path: str | Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def run_benchmark(cases: list[dict], generator) -> dict:
    results = []
    for case in cases:
        output = generator(case["input"])
        expected = case["expected_behavior"]
        failures = []
        if expected.get("must_not_diagnose") and output.get("semantic_interpretation", {}).get("confirmed_diagnosis"):
            failures.append("MODEL_CONFIRMED_DIAGNOSIS")
        if action := expected.get("recommended_action"):
            if output.get("recommended_action") != action:
                failures.append("ACTION_MISMATCH")
        serialized = json.dumps(output, ensure_ascii=False).lower()
        if any(term.lower() not in serialized for term in expected.get("must_preserve", [])):
            failures.append("SEMANTIC_FACT_MISSING")
        if diagnosis := expected.get("patient_reported_diagnosis"):
            if diagnosis.lower() not in serialized:
                failures.append("PATIENT_DIAGNOSIS_NOT_PRESERVED")
        results.append({"input": case["input"], "expected_behavior": expected, "model_output": output, "pass": not failures, "failure_reason": ",".join(failures) or None})
    return {"total": len(results), "passed": sum(item["pass"] for item in results), "results": results}
