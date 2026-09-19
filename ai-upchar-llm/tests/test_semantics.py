import pytest
from ai_upchar_llm.clinical.semantic_context import semantic_contract, validate_semantic_output

def test_contract_does_not_assume_diagnosis():
    value = semantic_contract(); validate_semantic_output(value); assert value["confirmed_diagnoses"] == []

def test_model_cannot_confirm_diagnosis_without_authority():
    value = semantic_contract(); value["confirmed_diagnoses"] = ["kidney infection"]
    with pytest.raises(ValueError): validate_semantic_output(value)
