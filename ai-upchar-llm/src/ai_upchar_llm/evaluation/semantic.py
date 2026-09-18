def semantic_pass(expected: dict, output: dict) -> bool:
    serialized = str(output).lower()
    return all(term.lower() in serialized for term in expected.get("must_preserve", [])) and not output.get("confirmed_diagnosis")
