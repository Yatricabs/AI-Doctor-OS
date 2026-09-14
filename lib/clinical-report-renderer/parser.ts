import type {
  ClinicalReportInput, ClinicalReportIR, ClinicalReportMetadata, InlineElement,
  ListBlock, ListItem, ParserDiagnostic, PriorityLevel, ReportBlock, SectionKind,
  SourceReference,
} from "./types";

const LABELS: Record<string, SectionKind> = {
  "main findings": "findings", "important information": "important",
  "clinical considerations": "considerations", "red flags": "red-flags",
  "urgent information": "urgent", "emergency information": "urgent",
  recommendations: "recommendations", evidence: "sources", sources: "sources",
};
const CITATION = /^(?:\[\d+\]|\[source-[^\]]+\]|\[\^\w+\])$/;
const CITATION_LIKE = /^\[[^\]\n]+\]$/;

function addDiagnostic(list: ParserDiagnostic[], code: ParserDiagnostic["code"], message: string) {
  list.push({ code, message });
}

function safeDestination(raw: string, input: ClinicalReportInput): { destination: string | null; safe: boolean } {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.startsWith("//")) return { destination: null, safe: false };
  try {
    const absolute = new URL(value);
    return absolute.protocol === "http:" || absolute.protocol === "https:"
      ? { destination: absolute.toString(), safe: true }
      : { destination: null, safe: false };
  } catch { /* relative URL, handled by the explicit host policy below */ }
  if (!input.safeLinkPolicy || !input.safeLinkContext) return { destination: null, safe: false };
  try {
    const origin = new URL(input.safeLinkContext.applicationOrigin).origin;
    const base = new URL(input.safeLinkContext.currentPath, origin);
    const resolved = new URL(value, base);
    const approved = input.safeLinkPolicy.approvedRelativePathPrefixes.some((prefix) => {
      const normalized = prefix.startsWith("/") ? prefix : `/${prefix}`;
      return resolved.pathname === normalized || resolved.pathname.startsWith(normalized.endsWith("/") ? normalized : `${normalized}/`);
    });
    return resolved.origin === origin && approved
      ? { destination: resolved.toString(), safe: true }
      : { destination: null, safe: false };
  } catch { return { destination: null, safe: false }; }
}

function inlineText(
  text: string, input: ClinicalReportInput, metadata: ClinicalReportMetadata,
  diagnostics: ParserDiagnostic[], ownerId: string, linkCounter: { value: number },
): InlineElement[] {
  const result: InlineElement[] = [];
  let cursor = 0;
  // Links are recognized before emphasis/citations so labels are kept as one semantic unit.
  const token = /(\[(?:[^\]\n]+)\]\((?:[^()\n]|\([^()\n]*\))*\)|\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|\[(?:\d+|source-[^\]]+|\^\w+)\])/g;
  for (const match of text.matchAll(token)) {
    const start = match.index ?? 0;
    if (start > cursor) result.push({ type: "text", text: text.slice(cursor, start) });
    const raw = match[0];
    const link = raw.match(/^\[([^\]]+)\]\((.+)\)$/);
    if (link) {
      linkCounter.value += 1;
      const sourceIndex = linkCounter.value - 1;
      const id = metadata.links?.find((item) => item.sourceIndex === sourceIndex)?.id ?? `link-${linkCounter.value}`;
      const resolved = safeDestination(link[2], input);
      if (!resolved.safe) addDiagnostic(diagnostics, "invalid-link", `Link ${id} was preserved as text because its destination is not approved.`);
      result.push({ type: "link", id, label: link[1], destination: resolved.destination, safe: resolved.safe });
    } else if (raw.startsWith("**")) {
      result.push({ type: "strong", text: raw.slice(2, -2) });
    } else if (raw.startsWith("*")) {
      result.push({ type: "emphasis", text: raw.slice(1, -1) });
    } else {
      const citation = metadata.citations?.find((item) => item.marker === raw);
      if (citation || CITATION.test(raw)) {
        const id = citation?.id ?? `citation-${result.length + 1}`;
        const associationIds = citation?.contentIds === undefined ? [ownerId] : citation.contentIds;
        result.push({ type: "citation", id, marker: raw, associationIds, ...(citation?.linkId ? { linkId: citation.linkId } : {}), ...(citation?.linkedSourceId ? { linkedSourceId: citation.linkedSourceId } : {}) });
      }
    }
    cursor = start + raw.length;
  }
  if (cursor < text.length) result.push({ type: "text", text: text.slice(cursor) });
  if (result.length === 0) result.push({ type: "text", text });
  if (/\*\*|(?<!\*)\*(?!\*)/.test(text) && result.every((item) => item.type === "text")) {
    addDiagnostic(diagnostics, "malformed-markdown", "An unmatched emphasis marker was preserved as readable text.");
  }
  if (text.split(/\s+/).some((part) => CITATION_LIKE.test(part) && !CITATION.test(part))) {
    addDiagnostic(diagnostics, "unassociated-citation", "An unsupported citation-like marker was preserved without an association.");
  }
  return result;
}

function parseList(
  lines: string[], start: number, input: ClinicalReportInput, metadata: ClinicalReportMetadata,
  diagnostics: ParserDiagnostic[], nextId: () => string, linkCounter: { value: number },
): { block: ReportBlock; next: number } | null {
  const first = lines[start].match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
  if (!first || first[1].length > 0) return null;
  const parseLevel = (index: number, indent: number): { list: ListBlock; next: number } => {
    const firstAtLevel = lines[index].match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
    if (!firstAtLevel || firstAtLevel[1].length !== indent) return { list: { ordered: false, items: [] }, next: index };
    const ordered = /^\d/.test(firstAtLevel[2]);
    const items: ListItem[] = [];
    let i = index;
    while (i < lines.length) {
      const marker = lines[i].match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
      if (!marker || marker[1].length !== indent || /^\d/.test(marker[2]) !== ordered) break;
      const itemId = nextId();
      const item: ListItem = { id: itemId, inlines: inlineText(marker[3], input, metadata, diagnostics, itemId, linkCounter), children: [] };
      items.push(item); i += 1;
      while (i < lines.length && !lines[i].trim()) i += 1;
      const child = lines[i]?.match(/^(\s+)([-+*]|\d+[.)])\s+(.*)$/);
      if (child && child[1].length > indent) {
        const nested = parseLevel(i, child[1].length);
        if (nested.list.items.length) item.children.push(nested.list);
        i = nested.next;
      }
    }
    return { list: { ordered, items }, next: i };
  };
  const parsed = parseLevel(start, first[1].length);
  return { block: { type: "list", id: nextId(), ordered: parsed.list.ordered, items: parsed.list.items }, next: parsed.next };
}

function applySections(blocks: ReportBlock[], metadata: ClinicalReportMetadata, diagnostics: ParserDiagnostic[], headingRanges: Map<string, { start: number; end: number }>) {
  const headings = blocks.filter((block): block is Extract<ReportBlock, { type: "heading" }> => block.type === "heading");
  for (const heading of headings) {
    const exact = LABELS[heading.text.trim().toLowerCase()];
    const candidates = metadata.sections ?? [];
    const direct = candidates.find((section) => section.headingId === heading.id);
    const range = headingRanges.get(heading.id);
    const ranged = candidates.find((section) => section.sourceRange && range && section.sourceRange.start <= range.start && section.sourceRange.end >= range.end);
    const exactMatches = candidates.filter((section) => section.label.trim().toLowerCase() === heading.text.trim().toLowerCase());
    if (exactMatches.length > 1) addDiagnostic(diagnostics, "invalid-metadata", `Section label ${heading.text} has ambiguous metadata.`);
    const supplied = direct ?? ranged ?? (exactMatches.length === 1 ? exactMatches[0] : undefined);
    heading.sectionKind = supplied?.kind ?? exact;
    if (supplied) heading.sectionId = supplied.id;
    if (heading.sectionKind === "red-flags") heading.priority = "warning";
    if (heading.sectionKind === "urgent") heading.priority = "urgent";
    if (heading.sectionKind === "important") heading.priority = "important";
  }
  let current: { id?: string; kind?: SectionKind; priority?: PriorityLevel } = {};
  for (const block of blocks) {
    if (block.type === "heading") current = { id: block.sectionId, kind: block.sectionKind, priority: block.priority };
    else if (block.type === "paragraph" || block.type === "list") { block.sectionId = current.id; if (current.priority) block.priority = current.priority; }
  }
  for (const block of blocks) {
    const priority = "id" in block ? metadata.priorities?.find((item) => item.targetId === block.id) : undefined;
    if (priority && "priority" in block) block.priority = priority.level;
  }
  const ordered = metadata.sections?.map((section) => section.order);
  if (ordered?.some((value) => value !== undefined) && (ordered.some((value) => value === undefined) || new Set(ordered).size !== ordered.length)) {
    addDiagnostic(diagnostics, "invalid-order", "Section order was incomplete or duplicated; source order was retained.");
  }
}

function preserveSources(metadata: ClinicalReportMetadata, input: ClinicalReportInput, diagnostics: ParserDiagnostic[]): SourceReference[] {
  const sources = metadata.sources ?? [];
  const withIndex = sources.map((source, index) => {
    const safe = source.destination ? safeDestination(source.destination, input) : { destination: undefined, safe: true };
    if (source.destination && !safe.safe) addDiagnostic(diagnostics, "invalid-link", `Source ${source.id} has an unsafe destination and remains text-only.`);
    return { ...source, destination: safe.destination ?? undefined, originalIndex: source.originalIndex ?? index };
  });
  const orders = withIndex.map((source) => source.order);
  const complete = withIndex.length > 0 && orders.every((value) => Number.isInteger(value)) && new Set(orders).size === orders.length;
  if (orders.some((value) => value !== undefined) && !complete) addDiagnostic(diagnostics, "invalid-order", "Source order was incomplete, duplicated, or invalid; supplied source order was retained.");
  return complete ? [...withIndex].sort((a, b) => (a.order as number) - (b.order as number)) : withIndex.sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
}

export function parseClinicalReport(input: ClinicalReportInput): ClinicalReportIR {
  const source = input.source == null ? null : String(input.source);
  const metadata = { ...(input.metadata ?? {}) };
  const snapshot = { text: source, isPresent: source !== null, isWhitespaceOnly: source !== null && source.trim() === "" };
  const diagnostics: ParserDiagnostic[] = [];
  if (input.upstreamError) {
    addDiagnostic(diagnostics, "upstream-error", input.upstreamError.message);
    return { state: "error", source: snapshot, metadata, diagnostics, blocks: [] };
  }
  if (!source || !source.trim()) return { state: "empty", source: snapshot, metadata, diagnostics, blocks: [] };

  const lines = source.split(/\r?\n/); const blocks: ReportBlock[] = []; const headingRanges = new Map<string, { start: number; end: number }>();
  let lineIndex = 0; let serial = 0; const linkCounter = { value: 0 }; const nextId = () => `block-${++serial}`;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (!line.trim()) { lineIndex += 1; continue; }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) { const id = nextId(); blocks.push({ type: "heading", id, level: heading[1].length, text: heading[2] }); const start = lines.slice(0, lineIndex).join("\n").length; headingRanges.set(id, { start, end: start + line.length }); lineIndex += 1; continue; }
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { blocks.push({ type: "separator", id: nextId() }); lineIndex += 1; continue; }
    const list = parseList(lines, lineIndex, input, metadata, diagnostics, nextId, linkCounter);
    if (list) { blocks.push(list.block); lineIndex = list.next; continue; }
    if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) { addDiagnostic(diagnostics, "malformed-markdown", "A list marker could not be parsed."); blocks.push({ type: "fallback", id: nextId(), text: line.trim(), diagnosticCodes: ["malformed-markdown"] }); lineIndex += 1; continue; }
    const paragraphLines = [line.trim()]; lineIndex += 1;
    while (lineIndex < lines.length && lines[lineIndex].trim() && !/^\s*#{1,6}\s+/.test(lines[lineIndex]) && !/^\s*(?:[-+*]|\d+[.)])\s+/.test(lines[lineIndex]) && !/^\s*(?:[-*_]\s*){3,}$/.test(lines[lineIndex])) { paragraphLines.push(lines[lineIndex].trim()); lineIndex += 1; }
    const id = nextId(); blocks.push({ type: "paragraph", id, inlines: inlineText(paragraphLines.join(" "), input, metadata, diagnostics, id, linkCounter) });
  }

  applySections(blocks, metadata, diagnostics, headingRanges);
  const links = new Set<string>();
  const linkedCitations: { item: Extract<InlineElement, { type: "citation" }> }[] = [];
  const inspect = (items: InlineElement[]) => items.forEach((item) => { if (item.type === "link") links.add(item.id); if (item.type === "citation" && item.linkId) linkedCitations.push({ item }); });
  const inspectBlock = (block: ReportBlock) => { if (block.type === "paragraph") inspect(block.inlines); if (block.type === "list") block.items.forEach((item) => { inspect(item.inlines); item.children.forEach((child) => child.items.forEach((nested) => inspect(nested.inlines))); }); };
  blocks.forEach(inspectBlock);
  linkedCitations.forEach(({ item }) => { if (!links.has(item.linkId!)) { addDiagnostic(diagnostics, "unassociated-citation", `Citation ${item.id} references an unavailable link identity.`); delete item.linkId; } });

  const sourceHeadingIndex = blocks.findIndex((block) => block.type === "heading" && block.sectionKind === "sources");
  const sourceHeading = sourceHeadingIndex >= 0 ? blocks[sourceHeadingIndex] : undefined;
  if (metadata.sources?.length && sourceHeading?.type === "heading") {
    // The source-section renders its own heading (from the preserved label) inside the
    // sources region, so replace the parsed heading block instead of leaving it in place;
    // keeping both would emit two identical headings for the same section.
    blocks.splice(sourceHeadingIndex, 1, { type: "source-section", id: `sources-${sourceHeading.id}`, label: sourceHeading.text, sources: preserveSources(metadata, input, diagnostics) });
  }
  return { state: diagnostics.length ? "fallback" : "ready", source: snapshot, metadata, diagnostics, blocks };
}

export { safeDestination };
