import json

from ai_upchar_llm.clinical.next_best_question import validate_reasoning_response
from ai_upchar_llm.clinical.safety_contract import enforce_safety_floor


def build_prompt(request: dict) -> str:
    return json.dumps({"instruction": "Interpret context and recommend one action. Never diagnose, prescribe, or mutate application state.", "contract": request}, ensure_ascii=False)


def validate_and_guard(output: dict, safety_state: dict) -> dict:
    guarded = enforce_safety_floor(safety_state, output)
    validate_reasoning_response(guarded)
    return guarded
