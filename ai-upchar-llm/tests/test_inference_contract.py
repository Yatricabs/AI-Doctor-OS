import pytest
from fastapi.testclient import TestClient
from ai_upchar_llm.clinical.next_best_question import validate_reasoning_response
from ai_upchar_llm.inference.server import create_app, validate_request, vllm_command

def test_required_api_input():
    with pytest.raises(ValueError): validate_request({"current_answer":"pain"})

def test_output_contract():
    validate_reasoning_response({"semantic_interpretation":{},"recommended_action":"CLARIFY","next_best_question":"Please clarify."})

def test_disallowed_state_mutation_action():
    with pytest.raises(ValueError): validate_reasoning_response({"semantic_interpretation":{},"recommended_action":"SET_DIAGNOSIS"})

def test_vllm_is_private_by_default():
    command = vllm_command()
    assert command[command.index("--host") + 1] == "127.0.0.1"
    assert "--max-model-len" in command and "--tensor-parallel-size" in command

def test_gateway_health_and_unconfigured_model_failure(monkeypatch):
    monkeypatch.delenv("MODEL_PATH", raising=False)
    client = TestClient(create_app())
    assert client.get("/health").json() == {"status": "ok", "model_path_configured": False}
    response = client.post("/v1/clinical/reason", json={"patient_context": {}, "current_answer": "pain", "semantic_context": {}, "safety_state": {"status": "CLEAR"}, "retrieved_evidence": []})
    assert response.status_code == 503
