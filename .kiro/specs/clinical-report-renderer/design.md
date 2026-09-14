# Clinical Report Renderer Design

## Overview

The clinical report renderer is a reusable, human-facing presentation boundary for AI-generated clinical reports. It accepts original report source and optional explicit metadata or semantic structure, parses supported Markdown into a framework-independent semantic representation, and renders that representation for patients, clinicians, and care teams.

The renderer is not a clinical reasoning, triage, diagnosis, data-fetching, or content-generation system. Parsing identifies supported structure; presentation applies layout and visual treatment. It SHALL NOT infer, invent, rewrite, summarize, strengthen, weaken, truncate, or clinically reinterpret source content. In particular, ordinary keywords never infer clinical priority. Warning, red-flag, urgent, or emergency treatment requires explicit metadata or an explicit report structure.

## Architecture

The renderer has three independent layers:

1. **Input boundary** receives original source and optional explicit metadata/state from a host. It performs no fetching, report generation, patient-workflow handling, or clinical classification.
2. **Semantic parsing** converts input into `ClinicalReportIR`, preserving source text, metadata, semantic structure, diagnostics, and state.
3. **Presentation** consumes only the IR and presentation options. Host context and theme may change layout only; they may not change semantic content, hierarchy, citations, links, source order, or explicit priority.

```text
source + explicit metadata/state -> parser -> ClinicalReportIR -> renderer -> host surface
```

The same source and metadata produce equivalent semantic content in every supported host context. Future reports using the documented constructs and metadata use this boundary without report-specific presentation logic.

## Components and Interfaces

### Input and state contract

```ts
type SafeLinkResolutionContext = {
  applicationOrigin: string;
  currentPath: string;
};

type ClinicalReportInput = {
  source: string | null | undefined;
  metadata?: ClinicalReportMetadata;
  safeLinkPolicy?: SafeLinkPolicy;
  safeLinkContext?: SafeLinkResolutionContext;
  upstreamError?: { code?: string; message: string } | null;
};

type ClinicalReportIR = {
  state: "empty" | "error" | "fallback" | "ready";
  source: SourceSnapshot;
  metadata: ClinicalReportMetadata;
  diagnostics: ParserDiagnostic[];
  blocks: ReportBlock[];
};

type SourceSnapshot = {
  text: string | null;
  isPresent: boolean;
  isWhitespaceOnly: boolean;
};

type ParserDiagnostic = {
  code:
    | "malformed-markdown"
    | "unsupported-syntax"
    | "invalid-metadata"
    | "invalid-link"
    | "upstream-error"
    | "invalid-order"
    | "source-representation-conflict"
    | "unassociated-citation";
  message: string; // non-clinical explanation only
  sourceRange?: { start: number; end: number };
};
```

The four states are non-overlapping:

- **`empty`**: source is absent, empty, or whitespace-only and there is no upstream error. Preserve `source.text` as `null` or the original whitespace, presence flags, and supplied metadata only as inert metadata. `blocks` contains no clinical content and diagnostics are empty. The renderer shows a clear non-clinical empty state and never invents findings, recommendations, warnings, emergencies, citations, or sources.
- **`error`**: `upstreamError` is supplied, regardless of whether source is also present, or the host explicitly reports that no usable source was obtained because of an upstream failure. Preserve the error code/message as a non-clinical diagnostic, preserve the original source text and metadata, and do not synthesize blocks. If the supplied source can be parsed, its readable blocks may be represented only as preserved non-clinical diagnostic context (for example, an expandable “received source” diagnostic); they are never a ready or fallback clinical report and are not presented as clinical content. If parsing is not attempted, source remains available in `SourceSnapshot` and diagnostics explain that it was not used. The renderer shows a clear non-clinical error state and never replaces the report with clinical text.
- **`fallback`**: source is present, no upstream error exists, and at least one parser limitation prevents complete semantic parsing while readable source content remains available. Preserve complete original source, all readable content in source order, metadata, and limitation diagnostics. Parsed supported blocks remain structured; affected content is readable fallback text. No content is silently removed or clinically reinterpreted.
- **`ready`**: source is present, no upstream error exists, and supported parsing completes without a limitation requiring fallback. Preserve complete original source, all parsed readable content, metadata, and diagnostics (normally empty). Blocks contain the supported semantic representation in source/explicit order.

Upstream error precedence is therefore absolute: `upstreamError` produces `error` before empty/fallback/ready classification. It does not authorize synthesis, metadata-to-content conversion, or clinical fallback. Source and metadata are retained for auditability, and any readable source context is explicitly non-clinical diagnostic context only.

State never grants permission to invent or alter content. The renderer may add only non-clinical state labels or parser diagnostics.

### Parser and renderer boundary

`ClinicalReportParser` parses supported headings, paragraphs, unordered/ordered/nested lists, bold, emphasis, separators, citation markers, source references, and inline links before presentation. `ClinicalReportRenderer` consumes only `ClinicalReportIR` and presentation options. It renders semantic headings, regions, paragraphs, lists, emphasis, separators, citations, sources, links, explicit section labels, recommendations, priority blocks, fallback content, and non-clinical state views. It does not fetch, generate, classify, or inject presentation markup into clinical text.

The renderer may depend on a host UI framework only at the presentation edge. Host integration passes source and explicit metadata into the parser and passes only IR plus presentation options into the renderer. Upstream no-source/error conditions remain explicit states.

## Data Models

The parser copies the supplied `ClinicalReportMetadata` into the IR without clinical reinterpretation. Known fields remain available to semantic rules, `unknown` and any otherwise unknown input fields are preserved as inert metadata, and missing metadata remains absent; parsing never derives metadata from report wording. All states preserve the input metadata object semantically, including unknown fields.

```ts
type SafeLinkPolicy = {
  approvedRelativePathPrefixes: string[];
};
```

`SafeLinkPolicy` is a host-supplied contract. The host also supplies `safeLinkContext` with an explicit `applicationOrigin` and `currentPath` whenever approved relative links are to be actionable; the parser never infers either value from the report, route, environment, or browser. If no policy or no complete context is supplied, relative URLs are preserved as non-actionable links (`safe: false`, `destination: null`). When both policy and context are supplied, the parser resolves each relative URL against `new URL(currentPath, applicationOrigin)` and makes it actionable only when the resolved URL remains on the application origin and its path remains within one of `approvedRelativePathPrefixes`; the policy does not permit navigation outside those prefixes. Absolute `http:`/`https:` URLs retain the absolute-link behavior below and do not require a relative-prefix approval. The host supplies the policy and context explicitly at the parser boundary; the renderer does not infer them from the report, route, or environment.

```ts
type ClinicalReportMetadata = {
  sections?: SectionMetadata[];
  priorities?: PriorityMetadata[];
  citations?: CitationMetadata[];
  sources?: SourceReference[];
  unknown?: Record<string, unknown>;
};

type SectionMetadata = {
  id: string;
  label: string;
  kind?: "findings" | "important" | "considerations" | "red-flags" |
    "urgent" | "recommendations" | "sources" | "custom";
  order?: number;
  parentId?: string;
  headingId?: string;
  sourceRange?: { start: number; end: number };
};

type PriorityMetadata = {
  targetId: string;
  level: "normal" | "important" | "warning" | "urgent";
  explicit: true;
  source?: "metadata" | "section";
  order?: number;
};
```

### Blocks and sections

```ts
type ReportBlock =
  | { type: "heading"; id: string; level: number; text: string; sectionId?: string }
  | { type: "paragraph"; id: string; inlines: InlineElement[]; sectionId?: string }
  | { type: "list"; id: string; ordered: boolean; items: ListItem[]; sectionId?: string }
  | { type: "separator"; id: string }
  | SourceSectionBlock
  | { type: "priority"; id: string; level: "important" | "warning" | "urgent"; content: ReportBlock[]; sectionId?: string }
  | { type: "fallback"; id: string; text: string; diagnosticCodes: ParserDiagnostic["code"][] };

type ListItem = { id: string; inlines: InlineElement[]; children: ListBlock[] };
type ListBlock = { ordered: boolean; items: ListItem[] };
type InlineElement =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "emphasis"; text: string }
  | { type: "link"; id: string; label: string; destination: string | null; safe: boolean }
  | CitationInline;
```

Section metadata retains stable IDs, display labels, optional semantic kind, parent relationship, optional direct heading identity, source range, and explicit order. A section label is never inferred from ordinary prose merely because a heading contains a keyword. `custom` preserves caller-defined structure without clinical interpretation. When `headingId` is present, it identifies the heading block directly and takes precedence as the explicit heading association. Otherwise, `sourceRange` may identify the heading range. If neither `headingId` nor `sourceRange` exists, the parser may associate the section with exactly one heading only when the metadata `label` and the heading text are equal after trimming surrounding whitespace and comparing case-insensitively. Partial labels, extra words, keyword matches, and multiple matching headings do not associate; the metadata remains unassociated and receives a diagnostic in those cases. The original heading text is always preserved.

### Supported explicit section labels and parsing

The parser recognizes an explicit heading section only when the heading text, after trimming surrounding whitespace, exactly matches one of these labels case-insensitively: `Main Findings`, `Important Information`, `Clinical Considerations`, `Red Flags`, `Urgent Information`, `Emergency Information`, `Recommendations`, `Evidence`, or `Sources`. These are label matches, not arbitrary keyword searches; partial matches, headings with extra words, ordinary prose, and unsupported headings do not receive a supported clinical section role. A caller-supplied `SectionMetadata` with `headingId` or `sourceRange` may explicitly designate a section even when its heading uses another label. If neither is supplied, association is allowed only for exactly one heading whose trimmed text equals the metadata `label` case-insensitively; this exact equality is the explicit caller signal, not inference. No partial/extra-word match, ambiguous multiple match, or keyword match is allowed. Preserve the heading text exactly, including when metadata is unassociated.

For supported labels, map `Main Findings` to `findings`, `Important Information` to `important`, `Clinical Considerations` to `considerations`, `Red Flags` to `red-flags`, `Urgent Information` and `Emergency Information` to `urgent`, `Recommendations` to `recommendations`, and `Evidence` and `Sources` to `sources`. Preserve the original heading text exactly in the heading block and section label. Explicit `Red Flags` receives warning treatment, explicit `Urgent Information`/`Emergency Information` receives urgent treatment, and explicit `Important Information` receives important treatment. The other named sections retain normal semantic section styling unless valid explicit priority metadata applies. Caller metadata may supply the section kind/priority for a custom heading; ordinary or partial heading matches never do.

### Section and source ordering

Source order is the default for report blocks, headings, sections, parent/child sections, and source references. A heading establishes a section boundary in source order; subsequent blocks belong to that section until the next heading at the same or higher level. Parent/child relationships from `parentId` preserve hierarchy and do not reorder blocks within a parent or child section.

`SectionMetadata.order` is an optional section-level ordering signal. It applies only when every participating section has a unique, valid, complete order (one entry per section, no duplicate values, no unknown section IDs, and no conflicting parent/child constraints). A valid complete explicit section order may reorder whole sections only; it never reorders headings or content within a section, breaks parent/child relationships, or moves content across section boundaries. Sections without a complete valid explicit order remain in source order. Invalid, incomplete, duplicate, unknown, or conflicting order entries fall back to source order and add an `invalid-order` diagnostic; the parser never guesses a partial order.

For source references, `metadata.sources` is authoritative when provided: it defines the source-reference records, IDs, labels, destinations, citation IDs, and metadata ordering. A source-section block parsed from report text is parsed source content, not an implicit replacement for metadata. It may link to metadata records by matching explicit IDs/citation IDs, but duplicate or conflicting records are not silently merged. The IR retains both readable representations and emits `source-representation-conflict`, or retains the metadata-authoritative structured record plus the parsed source text as a separate readable block when deterministic metadata authority is required. Neither representation is discarded. `SourceReference.originalIndex` records supplied-list position.

A source order is valid and complete only when exactly one ordering representation is supplied for the participating source references: either `SourceSectionBlock.explicitOrder` contains every known source ID exactly once, with no unknown IDs, duplicates, omissions, or conflicting source-reference `order` values, or every participating `SourceReference` has a unique finite integer `order` and those values define one entry per known source ID without gaps, unknown IDs, duplicates, or conflicts with `explicitOrder`. Source IDs themselves must be known and unique. An explicit order that is partial, empty when sources exist, duplicated, unknown, non-finite/non-integer, or contradictory with another order signal is invalid. A valid complete order applies only to source references; it never reorders report blocks, headings, sections, or source-section placement. Otherwise, sources render deterministically by `originalIndex` (the supplied source order), or by parsed source order when no metadata source list exists. Every invalid, incomplete, duplicate, unknown, or conflicting source-order signal falls back to that deterministic original/source order and emits an `invalid-order` diagnostic; the parser never guesses a partial order. Sources are never fabricated, deduplicated, or reordered by relevance.

```ts
type SourceReference = {
  id: string;
  label: string;
  destination?: string;
  citationIds?: string[];
  order?: number;
  originalIndex?: number;
};

type SourceSectionBlock = {
  type: "source-section";
  id: string;
  label: string;
  sources: SourceReference[];
  explicitOrder?: string[];
};
```

### Citation contract and association

The only supported citation marker forms are `[1]`, `[source-1]`, and `[^1]`, plus an explicitly identified linked citation whose metadata identifies the inline link by `linkId` and may identify its linked source with `linkedSourceId`. Marker text is preserved exactly, including brackets and identifier. Every parsed inline link receives a deterministic stable `id` from its source-order position (`link-1`, `link-2`, and so on), unless caller-supplied link metadata provides an explicit identity that overrides that generated ID. Metadata-identified linked citations MUST reference an existing inline link by `linkId`. The Property 12 fixture contains one inline link and no caller-supplied link identity, so that link deterministically receives `link-1`; its citation association continues to use `linkId: "link-1"`. The linked citation preserves the inline link's label and destination, the link identity, citation identity, and any linked source identity; `linkedSourceId` does not replace or imply `linkId`. A marker is represented as:

```ts
type CitationMetadata = {
  id: string;
  marker: string;
  contentIds?: string[];
  linkId?: string;
  sourceId?: string;
  linkedSourceId?: string;
  order?: number;
};

type CitationInline = {
  type: "citation";
  id: string;
  marker: string;
  associationIds: string[];
  linkId?: string;
  linkedSourceId?: string;
};
```

The supported structured citation contract is intentionally narrower than the general citation-marker glossary. The renderer preserves every citation-like marker visibly and readably, but only `[1]`, `[source-1]`, `[^1]`, and metadata-identified linked citations receive structured citation association. Other bracketed, footnote-like, or inline-source-like forms remain faithful fallback text with no invented association and receive an `unassociated-citation` diagnostic. For a supported citation, an omitted `contentIds` field permits an unambiguous containment association to the smallest containing semantic block or inline element. An explicitly supplied `contentIds: []` means that there is no explicit content-target association, so the parser MUST NOT infer a containing target. Non-empty explicit `contentIds` take precedence over containment. `linkedSourceId` associates the citation with the source record independently of content association, and the marker remains visible. A metadata-identified linked citation is valid only when its `linkId` references an existing inline link; if the link identity is missing or does not resolve, the citation remains visible/readable but receives an `unassociated-citation` diagnostic and gains no linked-citation association. When valid, `linkedSourceId` may additionally identify the linked source and must not alter the preserved label, destination, link identity, or citation identity. Explicitly identified linked citations retain their label, destination, and citation identity. Rendering keeps every marker distinguishable from ordinary prose and associates it only as specified by these rules.

### Priority semantics

For a target with multiple signals, apply: **valid explicit target-level priority metadata**, then **valid explicit section priority metadata**, then **supported structural role**, then **normal**. A valid explicit signal has a known level, an existing target, and a usable identity. Conflicts at the same precedence resolve by first occurrence in metadata order; invalid or incomplete signals are ignored and diagnosed. No fallback escalates beyond the highest valid explicit signal.

Structural mapping is explicit and deterministic: an exact, case-insensitive supported heading label maps `Red Flags` to the `warning` treatment, `Urgent Information` or `Emergency Information` to the `urgent` treatment, and `Important Information` to the `important` treatment. The remaining supported labels establish their named semantic sections but retain normal section styling unless valid explicit priority metadata applies. `SectionMetadata.kind: "red-flags"` maps to the `warning` treatment, while `SectionMetadata.kind: "urgent"` maps to the `urgent` treatment; `kind: "important"` maps to the `important` treatment. Priority metadata levels are exactly `normal`, `important`, `warning`, and `urgent`; `warning` is the treatment used for red flags and `urgent` is the treatment used for urgent/emergency information. This mapping is a structural signal only. It never uses keyword inference from labels or ordinary prose: only one of the exact documented labels or caller-supplied section metadata can establish the corresponding section or priority. Partial labels, extra words, arbitrary headings, and heading-like phrases in prose have no effect.

Bold and emphasis are styling-only inline roles. They may produce stronger or emphasized typography, but they never create `important`, `warning`, `red-flag`, `urgent`, or `emergency` classification. No source semantic role can create clinical priority merely through bold/emphasis. Structural section roles create priority only when the section is explicitly supplied or explicitly named by supported report structure, not from keyword matching in ordinary prose. Ordinary keywords, sentiment, or prose patterns are never priority signals.

### Safe-link policy

Allowed destinations are valid absolute `https:` and `http:` URLs, plus application-approved relative URLs. Relative URLs require both a host-supplied `SafeLinkPolicy` and a complete `SafeLinkResolutionContext`; the parser resolves them against `new URL(currentPath, applicationOrigin)`, requires the resolved origin to equal `applicationOrigin`, and requires the resolved path to remain within one of the approved prefixes. If either policy or context is absent, relative destinations are preserved as non-actionable (`safe: false`, `destination: null`). Protocol-relative `//host/path` is not an approved relative URL. Absolute `http:`/`https:` URLs remain allowed as specified and do not require relative-prefix approval. Reject malformed URLs, empty destinations, control characters, unsupported schemes, scheme-relative URLs, and unsafe schemes including `javascript:`, `data:`, `vbscript:`, and `file:`.

For unsafe or invalid destinations, preserve the original readable link label and marker, set destination to `null`, and expose no clickable unsafe target. Allowed external links follow host policy; a new browsing context uses the equivalent of `target="_blank"` with `rel` including `noopener` and `noreferrer`. Link labels, source identifiers, URLs, and report text are text data and never interpreted as HTML, CSS, template code, or script.

## Correctness Properties

Each property test runs at least 100 iterations and is tagged `Feature: clinical-report-renderer, Property N: ...`.

### Property 1: Supported parsing preserves structure

**Supported parsing preserves structure** — supported constructs produce corresponding elements while source order, section order, nesting, parent-child relationships, and inline roles remain intact. **Validates: Requirements 1.1, 1.2.**
### Property 2: Explicit semantics remain available without inference

**Explicit semantics remain available without inference** — explicit metadata/sections reach presentation without presentation markup or additional clinical meaning. **Validates: Requirements 1.3, 6.4.**
### Property 3: Citation and source preservation

**Citation and source preservation** — supported citation identities, associations, visibility, readability, distinction, linked inline-link identity, linked source identity, metadata-source authority, conflict representation, and source order remain intact unless a valid complete explicit order applies. Unsupported citation-like markers remain visible fallback text with no association. **Validates: Requirements 2.1, 2.3, 8.4.**
### Property 4: Link association and safe handling

**Link association and safe handling** — allowed links retain label/destination association; invalid/unsafe destinations are non-actionable and never execute content. **Validates: Requirements 2.2, 7.5.**
### Property 5: Clinical content faithfulness

**Clinical content faithfulness** — wording and qualifiers remain faithful and no clinical facts or classifications are added. **Validates: Requirements 2.5, 8.1.**
### Property 6: Explicit section hierarchy and ordering

**Explicit section hierarchy and ordering** — present labels, hierarchy, parent/child relationships, and valid complete section order remain; invalid/conflicting order falls back to source order with a diagnostic; absent sections are not fabricated. **Validates: Requirements 3.1, 3.2, 3.3.**
### Property 7: Recommendation role

**Recommendation role** — recommendations remain distinguishable without becoming diagnoses or new instructions. **Validates: Requirement 3.4.**
### Property 8: Explicit warning/urgent prioritization

**Explicit warning/urgent prioritization** — exact text/context stays visible by default with corresponding priority and a non-color cue. **Validates: Requirements 3.5, 4.4, 4.5, 5.6, 8.2.**
### Property 9: Deterministic conservative priority mapping

**Deterministic conservative priority mapping** — explicit mapping is stable; conflicting/incomplete metadata never escalates or changes content, and bold/emphasis alone never classifies clinical priority. **Validates: Requirements 4.1-4.3, 4.7.**
### Property 10: Keyword-only non-inference

**Keyword-only non-inference** — alarming ordinary prose adds no warning, emergency, alarm icon, or elevated classification. **Validates: Requirements 4.6, 8.3.**
### Property 11: Framework-independent IR equivalence

**Framework-independent IR equivalence** — contexts preserve equivalent semantic content, hierarchy, citations, links, source order, explicit priorities, and state behavior; the second context is a test-only host fixture and adds no fetching, generation, or clinical classification. **Validates: Requirements 2.4, 6.1, 6.2, 9.6.**
### Property 12: Supported-format reuse

**Supported-format reuse** — a concrete future-format fixture containing documented Markdown constructs and any explicitly supplied section/citation metadata passes the same public parser -> IR -> renderer boundary, with generic block/role output, stable semantics when run with a second equivalent fixture or host context, and no report-name-dependent input or metadata requirement beyond the fixture's explicit semantic contract. The test observes only public boundary output; it does not inspect internal rendering branches or require any implementation-specific branch structure.
**Validates: Requirements 6.3.**
### Property 13: Resilient parsing and fallback
**Validates: Requirements 1.4**

**Resilient parsing and fallback** — mixed valid/malformed/unsupported content remains readable and later valid content renders. Additional traceability: Requirements 7.1, 7.2, 7.4, 8.5.
### Property 14: Upstream error precedence and preservation
**Validates: Requirements 6.5**

**Upstream error precedence and preservation** — whenever source and upstreamError are both present, state is `error`, original source/metadata remain preserved, no clinical blocks are synthesized, and any parsed source context is explicitly non-clinical diagnostic context only. Additional traceability: Requirement 8.5.

### Observable Property 12 fixture

The property test uses a fixed future-format fixture such as:

```md
# Follow-up summary

## Findings
The reported measurement remains within the supplied range.

## Recommendations
- Continue the documented follow-up plan.

## Evidence
[1] [Reference A](https://example.test/reference-a)
```

The fixture uses only documented Markdown constructs. The nonstandard `Findings` heading is explicitly associated by caller metadata: because it has no `headingId` or `sourceRange`, its metadata `label: "Findings"` matches exactly one heading after trimming and case-insensitive comparison. This is explicit metadata association, not keyword inference; the heading text remains `Findings`. The public-boundary input also includes explicit metadata identifying the citation and the inline link (`linkId: "link-1"`) plus its linked source; the metadata is part of the fixture contract, not report-name-dependent logic:

```ts
const futureFormatInput = {
  source: futureFormatFixture,
  metadata: {
    sections: [
      { id: "findings", label: "Findings", kind: "findings" },
      { id: "recommendations", label: "Recommendations", kind: "recommendations" },
      { id: "evidence", label: "Evidence", kind: "sources" },
    ],
    citations: [
      {
        id: "citation-1",
        marker: "[1]",
        contentIds: [],
        linkId: "link-1",
        linkedSourceId: "source-1",
      },
    ],
    sources: [
      {
        id: "source-1",
        label: "Reference A",
        destination: "https://example.test/reference-a",
        citationIds: ["citation-1"],
      },
    ],
  },
};
```

The test passes this exact input through the same public parser -> IR -> renderer boundary used by current reports, compares the resulting semantic content with expected generic blocks/roles, verifies the citation marker remains visible and retains `citation-1` linked to the inline link `link-1` and source-1 via `linkedSourceId` without an explicit content-target association, and then repeats the boundary with a second equivalent fixture or host context to verify stable semantics. It supplies no report-name-dependent input beyond the explicit metadata contract or invented content target. The assertion is implementation-agnostic: it observes generic public boundary output and does not inspect internal rendering branches or require any implementation-specific branch structure.

## Error Handling

Malformed or unsupported syntax is handled block-by-block. Unmatched emphasis, malformed lists, incomplete links, unclosed formatting, unsupported constructs, and unknown metadata do not invalidate unrelated content. Readable source text remains visible; valid blocks remain structured; affected blocks use fallback representation; later content continues to render. Empty/whitespace-only input follows `empty`. Any upstream error follows `error` even if source exists, preserves source and metadata, never synthesizes content, and exposes only non-clinical error/diagnostic context. Parser/rendering limitations prefer visible faithful content plus a clear non-clinical indication over silent meaning changes.

The renderer SHALL NOT invent diagnoses, symptoms, risk levels, recommendations, red flags, urgency, evidence, citations, or patient-specific facts. Explicit red flags and urgent/emergency information remain visible, readable, and prioritized. Keyword-only prose never receives inferred warning or urgency classification.

## Testing Strategy

Use unit, property-based, browser, accessibility, and integration-boundary checks. Unit/property tests cover all state contracts, upstream error precedence, source/metadata preservation and authority, supported parsing, exact section association via `headingId`, `sourceRange`, or one exact trimmed case-insensitive label match with no partial/ambiguous/keyword inference, section ordering, citation associations and unsupported-marker fallback, deterministic source-order inline link IDs with caller-supplied identity overrides and linked-citation `linkId`/`linkedSourceId` preservation, safe links with an explicitly supplied `SafeLinkPolicy` and `SafeLinkResolutionContext` (`applicationOrigin`, `currentPath`) for approved relative-link cases plus the no-policy/no-context default, absolute `http`/`https` behavior, explicit priority precedence, red-flags-to-warning and urgent-to-urgent structural mapping, bold/emphasis styling-only behavior, keyword-only non-inference, clinical faithfulness, fallback behavior, and host-context equivalence. Every safety and acceptance-critical test is mandatory.

Browser tests use representative reports containing long paragraphs, long lists, nested lists, multiple citations, long source identifiers and URLs, malformed blocks, all explicit priority kinds, unsafe links, and the future-format fixture. At a **320 CSS px** narrow content width and **1440 CSS px** wide viewport, verify:

- body and source text font size is at least **16 CSS px**;
- body and source text line-height is at least **1.5**;
- the reading column is no wider than **760 CSS px** at wide viewports;
- ordinary report content reflows without horizontal overflow at 320 CSS px;
- adjacent distinct paragraph, list-item, heading, citation, and section blocks have a computed separation of at least **8 CSS px** in the reading direction, using context-appropriate spacing tokens;
- ordinary adjacent blocks do not have unexplained computed gaps greater than **48 CSS px** that fragment reading; larger gaps are permitted only at explicit section or priority boundaries and must correspond to a named context-specific spacing token;
- source order and heading/section scanning remain consistent at both 320 CSS px and 1440 CSS px;
- keyboard users can reach every actionable link in logical source order and every focused element has a visible focus indicator;
- semantic heading levels and report/priority regions are present and navigable;
- icons/non-text cues have accessible names or text alternatives, links have meaningful accessible names, and priority is understandable without color;
- text remains selectable and readable while scrolling, with no clipping, overlap, arbitrary truncation, or inaccessible source content;
- long URLs and source identifiers wrap or otherwise remain reachable; and
- rendered report text cannot execute as HTML/script.

Integration tests render identical source/metadata in at least two host contexts and compare semantic content, hierarchy, citations, links, source order, explicit priorities, and state behavior. Final validation runs type check, lint, unit/property, browser, accessibility, and integration tests in single-run mode where available, recording any unavailable browser/accessibility check and its exact limitation.

## Integration Boundary and Module Organization

```text
clinical-report-renderer/
  ClinicalReportInput and ClinicalReportIR
  ClinicalReportParser
  priority presentation mapper
  safe link handler
  ClinicalReportRenderer
  empty/error/fallback state components
  parser, renderer, safety, accessibility, browser, and integration tests
```

The parser and IR have no page, route, patient-workflow, data-service, or theme dependency. Host integration passes source and explicit metadata into the parser and passes only IR plus presentation options into the renderer. Host context and theme may change layout only; they may not change content, hierarchy, citations, links, source order, or explicit priority semantics.


## Additional Design Details for Renderer Verification

The approved parser, IR, state, safety, priority, link, accessibility, and integration contracts above remain authoritative. The additions in this section define verification seams only; they do not add application behavior or change the public clinical-report boundary.

### Renderer semantic and state test contract

`ClinicalReportRenderer` tests invoke the public renderer with a supplied `ClinicalReportIR` and presentation options. They do not inspect private component branches, CSS implementation details, or host data-fetching behavior. A semantic projection helper used only by tests normalizes observable output into:

```ts
type RendererSemanticProjection = {
  state: "empty" | "error" | "fallback" | "ready";
  blocks: Array<{
    type: string;
    text: string;
    level?: number;
    sectionId?: string;
    priority?: "normal" | "important" | "warning" | "urgent";
    citationIds?: string[];
    linkIds?: string[];
  }>;
  sourceOrder: string[];
  diagnostics: string[];
};
```

The projection is an assertion vocabulary, not a production API. Semantic renderer tests verify block and inline roles, heading levels, section labels and order, nested-list relationships, recommendation distinction, citation marker visibility and association, source authority/order, safe-link label/destination association, explicit priority signals, and exact readable wording. They assert that source text, qualifiers, metadata, and diagnostics are preserved and that no unsupported clinical content appears.

State tests use canonical IR fixtures for all four states. `empty` renders a non-clinical empty state with no blocks or fabricated clinical text; `error` takes precedence over every other state, preserves source/metadata and shows only a non-clinical error/diagnostic context; `fallback` renders readable fallback text alongside surviving structured blocks and diagnostics; and `ready` renders the complete structured report. The matrix includes upstream error with source, malformed input, unknown metadata, ordinary prose containing alarming keywords, and bold/emphasis-only content. It asserts source/metadata preservation, readable fallback, default visibility of explicit urgent/warning content, and absence of inferred priority. The same IR is rendered repeatedly to assert deterministic semantic output.

### Exact browser-testing dependency and lockfile contract

The test package manifest SHALL declare exactly one browser-testing dependency, `@playwright/test`, pinned to the exact version `1.49.1` (no caret, tilde, range, or `latest`). The repository `package-lock.json` SHALL contain the same `1.49.1` version for the root dependency and its resolved package entry. No second browser framework or unpinned browser-testing package is introduced. Browser tests use Playwright's single-run CLI/API; they do not start a development server from the test suite. The existing application host is started manually by the test operator or CI job before the browser command, with the base URL passed through the test configuration.

### Browser and accessibility execution

The browser suite runs the same mandatory browser-verifiable acceptance checklist and the additional renderer semantic/state browser cases against the Playwright projects `chromium`, `firefox`, and `webkit`. A project matrix failure is a suite failure; a test is not considered complete after Chromium alone passes. The suite uses representative reports covering all supported constructs, explicit section/priority variants, citations/sources, safe and unsafe links, malformed blocks, empty/error/fallback/ready states, long content, and the future-format fixture.

Each browser project executes at two viewport profiles: narrow `320 CSS px` content width and wide `1440 CSS px` viewport width. Assertions retain the existing approved thresholds: body/source font size at least 16 CSS px, body/source line-height at least 1.5, wide reading column no wider than 760 CSS px, no ordinary-content horizontal overflow, no clipping/overlap/arbitrary truncation, and readable source order. Accessibility checks use the rendered DOM and keyboard interaction to verify logical source-order tab reachability, visible focus, semantic heading levels and report/priority regions, meaningful accessible link names, text alternatives for icons/non-color cues, selectable report/source text, responsive reflow, and safe non-executable report text. Priority assertions require text/label/border/weight/layout cues in addition to color. Long URLs and source identifiers must remain reachable and wrap without widening the reading column.

The browser command is single-run and matrix-explicit, for example `npx playwright test --project=chromium --project=firefox --project=webkit`. Browser binaries are provisioned by the pinned Playwright package in the test environment; failures to provision a required engine are reported as an unavailable verification prerequisite rather than silently reducing the matrix. The suite must not use watch mode.

### Test-only second host fixture

Add a test-only host fixture under `tests/clinical-report-renderer/fixtures/second-host/`. It exposes the same public host adapter shape as the primary report host but receives a prebuilt `ClinicalReportIR` and presentation options, renders the same `ClinicalReportRenderer`, and supplies no fetcher, generator, patient-workflow state, route-derived policy, or clinical classifier. Its only intentional difference is a minimal alternate layout wrapper/theme so host equivalence is observable without changing semantic content.

The primary-host and second-host fixtures are both driven by the same source/metadata/state inputs. Boundary tests compare their renderer semantic projections and browser-observable content for headings, regions, source order, citations, links, explicit priorities, and all four states. The fixture is test-only, is excluded from production exports and application bundles, and must not be used to add host-specific interpretation. A fixture-level assertion verifies that no network/data-generation adapter is registered and that both hosts receive explicit safe-link policy/context rather than inferring either from the URL or environment.

## Renderer Verification Matrix

| Verification concern | Test level | Required coverage |
|---|---|---|
| Semantic block/inline output and content faithfulness | Unit + property | Public renderer boundary, generated semantic IR, at least 100 iterations for applicable properties |
| `empty`, `error`, `fallback`, `ready` and upstream-error precedence | Unit + property | Canonical state fixtures plus source/metadata/error combinations |
| Explicit priority and keyword-only non-inference | Unit + property + browser | All priority levels, emphasis-only and ordinary alarming prose, non-color cues |
| Host reuse | Integration + Property 11 | Primary host versus test-only second host, identical semantic projection and state behavior |
| Responsive and accessibility behavior | Browser/accessibility integration | 320/1440 profiles in all three engines, keyboard/focus/semantic/link/selection/overflow checks |
| Browser engine coverage | Browser integration | Chromium, Firefox, and WebKit using the exact pinned dependency |
| Dependency and fixture setup | Smoke | Manifest/lockfile exact-version parity and test-only fixture isolation |

### Property reflection

The existing properties are retained without duplicating browser or configuration checks. Renderer semantic/state assertions consolidate the overlapping state-preservation and non-inference cases under the existing Properties 5, 9, 10, 13, and 14; host equivalence remains covered by Property 11, now including the second-host fixture and Requirement 9.6. Browser-engine execution, accessibility observations, exact dependency pinning, and fixture isolation are integration/smoke checks rather than additional property-based claims because they verify external browser behavior or repository configuration. No redundant correctness property is added for those checks.
