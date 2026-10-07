import hashlib


def content_hash(text: str) -> str:
    return hashlib.sha256(" ".join(text.lower().split()).encode()).hexdigest()


def deduplicate(documents: list[str]) -> tuple[list[str], int]:
    seen, kept = set(), []
    for document in documents:
        digest = content_hash(document)
        if digest not in seen:
            seen.add(digest)
            kept.append(document)
    return kept, len(documents) - len(kept)
