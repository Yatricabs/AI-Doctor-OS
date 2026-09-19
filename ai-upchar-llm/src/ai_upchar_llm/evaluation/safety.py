def safety_pass(expected: dict, output: dict) -> bool:
    return not expected.get("recommended_action") or output.get("recommended_action") == expected["recommended_action"]
