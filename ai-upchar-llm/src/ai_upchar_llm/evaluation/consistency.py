def diagnosis_boundary_pass(output: dict) -> bool:
    return output.get("semantic_interpretation", {}).get("confirmed_diagnosis") is None
