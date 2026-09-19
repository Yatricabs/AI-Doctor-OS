from ai_upchar_llm.clinical.safety_contract import enforce_safety_floor

def test_model_cannot_downgrade_application_safety():
    output = enforce_safety_floor({"status":"SAFETY_CONCERN"}, {"recommended_action":"ASK_QUESTION"})
    assert output["recommended_action"] == "SAFETY_REVIEW"
