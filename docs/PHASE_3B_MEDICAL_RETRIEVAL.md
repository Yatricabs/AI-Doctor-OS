# Phase 3B: Medical Knowledge Retrieval

Phase 3B is an additive enrichment layer on top of baseline checkpoint `353d0df`.
It does not replace semantic extraction, deterministic safety, edit/replay, or
application-controlled interview transitions.

## Flow

1. The existing semantic layer creates patient facts and problems.
2. `assessKnowledgeNeed` selects one of the four retrieval decisions.
3. A normalized, PII-minimized context is fingerprinted for deduplication.
4. `MedicalKnowledgeProvider` retrieves evidence when needed.
5. Evidence remains in `EvidenceContext`, separate from patient facts.
6. The next-question model may use evidence as context; application validation
   still controls the final question and state transition.

The initial provider uses the OpenAI Responses API web-search tool with an
allowlist of clinical, government, academic, and institutional domains. It
stores only citations actually returned by the provider. An empty or malformed
result is represented as uncertainty, never as invented evidence.

## Source hierarchy

Sources are classified as `GUIDELINE`, `GOVERNMENT`, `ACADEMIC`,
`INSTITUTIONAL`, `CURATED`, or `WEB`, then ordered by authority. The provider
interface can be replaced by curated, file/vector, or proprietary providers
without changing the interview flow.

## Failure, privacy, and caching

- Client timeout: 4 seconds; provider timeout: 8 seconds.
- Provider errors and timeouts return the existing reasoning path safely.
- Cache keys are SHA-256 fingerprints of normalized clinical context.
- The current in-memory cache expires after 10 minutes and stores no name,
  phone number, exact age, or raw patient profile.
- Structured diagnostics record decision, provider, context key, result count,
  source types, cache status, latency, and failure status without raw answers.
- Editing an answer changes the context fingerprint, so stale evidence is not
  reused for the rebuilt context.

## Remaining hard-coded clinical controls

The retrieval layer adds no disease-specific diagnosis rules. The following
hard-coded controls remain intentionally:

- The existing deterministic safety patterns remain authoritative because an
  urgent warning must not depend on network or model availability.
- The trusted-domain allowlist limits evidence provenance and is a security and
  quality control, not a disease classifier.
- Retrieval decision signals (unknown concept, patient-reported diagnosis,
  medication relationship, ambiguity, multiple problems, and safety context)
  are generic information-shape signals rather than disease-name lists.
- Source-domain classification is hard-coded so downstream reasoning can
  distinguish guideline/government/academic evidence from general web pages.

Retrieved evidence cannot confirm diagnoses, prescribe, downgrade safety, or
mutate patient answers, SEX, semantic facts, or interview state.
