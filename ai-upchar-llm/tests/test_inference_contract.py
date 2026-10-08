import pytest
from fastapi.testclient import TestClient
from ai_upchar_llm.clinical.next_best_question import validate_reasoning_response
from ai_upchar_llm.inference.model_registry import (
    V16_ARTIFACT_SHA256,
    V16_BASE_MODEL,
    V16_MODEL_VERSION,
    validate_v16_adapter_path,
)
from ai_upchar_llm.inference.server import create_app, validate_request, vllm_command


def test_required_api_input():
    with pytest.raises(ValueError):
        validate_request({"current_answer": "pain"})


def test_output_contract():
    validate_reasoning_response(
        {
            "semantic_interpretation": {},
            "recommended_action": "CLARIFY",
            "next_best_question": "Please clarify.",
            "missing_information": ["duration"],
            "clinical_considerations": ["Needs clinician review."],
            "confidence": "MEDIUM",
        }
    )


def test_incomplete_output_contract_is_rejected():
    with pytest.raises(ValueError, match="Missing clinical reasoning keys"):
        validate_reasoning_response(
            {
                "semantic_interpretation": {},
                "recommended_action": "CLARIFY",
            }
        )


def test_wrong_types_are_rejected_without_coercion():
    with pytest.raises(ValueError, match="missing_information"):
        validate_reasoning_response(
            {
                "semantic_interpretation": {},
                "recommended_action": "CLARIFY",
                "next_best_question": None,
                "missing_information": ["duration", 3],
                "clinical_considerations": [],
                "confidence": "MEDIUM",
            }
        )


def test_disallowed_state_mutation_action():
    with pytest.raises(ValueError):
        validate_reasoning_response(
            {"semantic_interpretation": {}, "recommended_action": "SET_DIAGNOSIS"}
        )


def test_vllm_requires_verified_v16_candidate(tmp_path, monkeypatch):
    adapter = tmp_path / "v16-adapter"
    adapter.mkdir()
    for name in ("adapter_config.json", "adapter_model.safetensors", "tokenizer_config.json"):
        (adapter / name).write_text("{}", encoding="utf-8")
    (adapter / "part2_v16_manifest.json").write_text(
        __import__("json").dumps(
            {
                "model": V16_BASE_MODEL,
                "artifact_sha256": V16_ARTIFACT_SHA256,
                "production_approved": False,
            }
        ),
        encoding="utf-8",
    )

    assert validate_v16_adapter_path(adapter) == adapter.resolve()
    monkeypatch.setenv("MODEL_PATH", str(adapter))
    command = vllm_command()
    assert command[1:3] == ["serve", V16_BASE_MODEL]
    assert "--enable-lora" in command
    assert f"{V16_MODEL_VERSION}={adapter.resolve()}" in command
    assert command[command.index("--host") + 1] == "127.0.0.1"
    assert "--max-model-len" in command and "--tensor-parallel-size" in command


def test_unverified_model_candidate_is_rejected(tmp_path):
    unverified = tmp_path / "unknown-model"
    unverified.mkdir()
    with pytest.raises(ValueError, match="required files"):
        validate_v16_adapter_path(unverified)


def test_vllm_is_private_by_default(monkeypatch):
    monkeypatch.delenv("MODEL_PATH", raising=False)
    with pytest.raises(RuntimeError, match="verified V16"):
        vllm_command()


def test_gateway_health_and_unconfigured_model_failure(monkeypatch):
    monkeypatch.delenv("MODEL_PATH", raising=False)
    client = TestClient(create_app())
    assert client.get("/health").json() == {"status": "ok", "model_path_configured": False}
    response = client.post(
        "/v1/clinical/reason",
        json={
            "patient_context": {},
            "current_answer": "pain",
            "semantic_context": {},
            "safety_state": {"status": "CLEAR"},
            "retrieved_evidence": [],
        },
    )
    assert response.status_code == 503
