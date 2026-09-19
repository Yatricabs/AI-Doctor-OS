from typing import Any


def semantic_contract() -> dict[str, Any]:
    return {"problems": [], "temporal_facts": [], "anatomy": [], "severity": [], "triggers": [], "associated_symptoms": [], "patient_reported_diagnoses": [], "confirmed_diagnoses": []}


def validate_semantic_output(value: dict[str, Any]) -> None:
    required = set(semantic_contract())
    if required - set(value):
        raise ValueError("Semantic output is incomplete")
    if value.get("confirmed_diagnoses") and not value.get("confirmation_authority"):
        raise ValueError("A model cannot independently confirm a diagnosis")
