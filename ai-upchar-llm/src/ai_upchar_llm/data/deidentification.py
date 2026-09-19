import re

PATTERNS = [
    (re.compile(r"\b[6-9]\d{9}\b"), "[PHONE]"),
    (re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"), "[EMAIL]"),
    (re.compile(r"\b\d{12}\b"), "[IDENTIFIER]"),
]


def deidentify(text: str) -> tuple[str, list[str]]:
    found = []
    for pattern, replacement in PATTERNS:
        text, count = pattern.subn(replacement, text)
        if count:
            found.append(replacement.strip("[]"))
    return text, found


def contains_direct_identifier(text: str) -> bool:
    return any(pattern.search(text) for pattern, _ in PATTERNS)
