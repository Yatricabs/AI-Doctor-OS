from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from privacy_fail_closed import (  # noqa: E402
    PRIVACY_CONTRACT_KEYS,
    SAFE_PRIVACY_FALLBACK,
    is_privacy_contract,
    privacy_fail_closed,
)


def test_fallback_is_explicit_and_preserves_frozen_contract_order():
    expected = dict.fromkeys(PRIVACY_CONTRACT_KEYS, "x")
    result = privacy_fail_closed(expected, {"privacy_action": "unsafe"}, ["missing_rule"])

    assert result["fallback_used"] is True
    assert result["model_output_rejected"] is True
    assert list(result["output"]) == list(PRIVACY_CONTRACT_KEYS)
    assert result["output"] == SAFE_PRIVACY_FALLBACK
    assert result["violations"] == ["missing_rule"]


def test_fallback_does_not_accept_or_hide_the_model_output():
    expected = dict.fromkeys(PRIVACY_CONTRACT_KEYS, "x")
    model_output = {"privacy_action": "Preserve identifiers"}
    result = privacy_fail_closed(expected, model_output, ["missing_safeguard"])

    assert result["model_output"] == model_output
    assert result["output"] != model_output


def test_fallback_is_restricted_to_e20_contract():
    assert is_privacy_contract(dict.fromkeys(PRIVACY_CONTRACT_KEYS, "x"))
    with pytest.raises(ValueError, match="only defined for the E20 contract"):
        privacy_fail_closed({"other": "x"}, {}, ["invalid"])
