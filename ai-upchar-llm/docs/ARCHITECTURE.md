# Architecture

Licensed documents flow through ingestion, normalization, language/quality
filtering, de-identification, deduplication, tokenization, and versioned shards.
Domain adaptation and SFT produce versioned adapters/full artifacts. Evaluation
gates release. A private vLLM process serves an OpenAI-compatible model endpoint;
the AI UPCHAR gateway exposes `POST /v1/clinical/reason` and validates outputs.

The response is advisory only: semantic interpretation, considerations, one of
`ASK_QUESTION | CLARIFY | SAFETY_REVIEW`, one next question, missing information,
and confidence. Application safety and state transitions remain authoritative.
