"""Fail-closed handling for the frozen Part 2 E20 privacy contract."""

from __future__ import annotations

from typing import Any

PRIVACY_CONTRACT_KEYS = (
    "privacy_action",
    "data_minimization",
    "response_rule",
    "clinical_focus",
)

SAFE_PRIVACY_FALLBACK = {
    "privacy_action": (
        "Do not repeat or expose unnecessary identifiers; use personal information "
        "only when required for an authorized clinical workflow."
    ),
    "data_minimization": (
        "Use only the minimum personal information necessary for the clinical task."
    ),
    "response_rule": "Do not echo sensitive identifiers; preserve the privacy boundary.",
    "clinical_focus": (
        "Keep the response focused on relevant clinical care while maintaining "
        "privacy boundaries."
    ),
}


def is_privacy_contract(expected: dict[str, Any]) -> bool:
    return tuple(expected) == PRIVACY_CONTRACT_KEYS


def privacy_fail_closed(
    expected: dict[str, Any], parsed: object, violations: list[str]
) -> dict[str, Any]:
    """Reject unsafe model output and return an explicitly marked fallback."""
    if not is_privacy_contract(expected):
        raise ValueError("Fail-closed fallback is only defined for the E20 contract")
    return {
        "output": dict(SAFE_PRIVACY_FALLBACK),
        "fallback_used": True,
        "model_output_rejected": True,
        "violations": list(violations),
        "model_output": parsed,
    }
