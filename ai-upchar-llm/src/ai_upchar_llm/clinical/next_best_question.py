from __future__ import annotations

import math
from typing import Any


ALLOWED_ACTIONS = {"ASK_QUESTION", "CLARIFY", "SAFETY_REVIEW"}
REQUIRED_RESPONSE_KEYS = {
    "semantic_interpretation",
    "recommended_action",
    "next_best_question",
    "missing_information",
    "clinical_considerations",
    "confidence",
}
ALLOWED_CONFIDENCE = {"LOW", "MEDIUM", "HIGH"}


def _is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def validate_reasoning_response(value: dict[str, Any]) -> None:
    """Fail closed on the complete six-key clinical reasoning contract.

    This validator intentionally performs no repair, coercion, or partial-object
    extraction. The gateway converts any failure into HTTP 502, allowing the
    application bridge to use its deterministic safety floor.
    """
    if not isinstance(value, dict):
        raise ValueError("Clinical reasoning response must be an object")

    missing = REQUIRED_RESPONSE_KEYS - set(value)
    if missing:
        raise ValueError(f"Missing clinical reasoning keys: {sorted(missing)}")

    if not isinstance(value["semantic_interpretation"], dict):
        raise ValueError("semantic_interpretation must be an object")

    action = value["recommended_action"]
    if action not in ALLOWED_ACTIONS:
        raise ValueError("Unsupported recommendation")

    next_question = value["next_best_question"]
    if next_question is not None and not isinstance(next_question, str):
        raise ValueError("next_best_question must be a string or null")
    if action == "ASK_QUESTION" and not isinstance(next_question, str):
        raise ValueError("ASK_QUESTION requires one next question")
    if action == "ASK_QUESTION" and not next_question.strip():
        raise ValueError("ASK_QUESTION requires a non-empty next question")

    for key in ("missing_information", "clinical_considerations"):
        if not _is_string_list(value[key]):
            raise ValueError(f"{key} must be an array of strings")

    confidence = value["confidence"]
    if confidence is not None:
        if isinstance(confidence, bool):
            raise ValueError("confidence must not be boolean")
        if isinstance(confidence, str):
            if confidence.upper() not in ALLOWED_CONFIDENCE:
                raise ValueError("Unsupported confidence label")
        elif isinstance(confidence, (int, float)):
            if not math.isfinite(float(confidence)):
                raise ValueError("confidence must be finite")
        else:
            raise ValueError("confidence must be a label, number, or null")
