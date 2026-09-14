export type SafeLinkResolutionContext = {
  applicationOrigin: string;
  currentPath: string;
};

export type SafeLinkPolicy = { approvedRelativePathPrefixes: string[] };
export type SourceRange = { start: number; end: number };
export type DiagnosticCode = "malformed-markdown" | "unsupported-syntax" | "invalid-metadata" | "invalid-link" | "upstream-error" | "invalid-order" | "source-representation-conflict" | "unassociated-citation";
export type ParserDiagnostic = { code: DiagnosticCode; message: string; sourceRange?: SourceRange };

export type SourceReference = { id: string; label: string; destination?: string; citationIds?: string[]; order?: number; originalIndex?: number };
export type SectionKind = "findings" | "important" | "considerations" | "red-flags" | "urgent" | "recommendations" | "sources" | "custom";
export type SectionMetadata = { id: string; label: string; kind?: SectionKind; order?: number; parentId?: string; headingId?: string; sourceRange?: SourceRange };
export type PriorityLevel = "normal" | "important" | "warning" | "urgent";
export type PriorityMetadata = { targetId: string; level: PriorityLevel; explicit: true; source?: "metadata" | "section"; order?: number };
export type LinkMetadata = { sourceIndex: number; id: string };
export type CitationMetadata = { id: string; marker: string; contentIds?: string[]; linkId?: string; sourceId?: string; linkedSourceId?: string; order?: number };
export type ClinicalReportMetadata = { sections?: SectionMetadata[]; priorities?: PriorityMetadata[]; citations?: CitationMetadata[]; sources?: SourceReference[]; links?: LinkMetadata[]; unknown?: Record<string, unknown> } & Record<string, unknown>;

export type InlineElement =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "emphasis"; text: string }
  | { type: "link"; id: string; label: string; destination: string | null; safe: boolean }
  | { type: "citation"; id: string; marker: string; associationIds: string[]; linkId?: string; linkedSourceId?: string };
export type ListItem = { id: string; inlines: InlineElement[]; children: ListBlock[] };
export type ListBlock = { ordered: boolean; items: ListItem[] };
export type SourceSectionBlock = { type: "source-section"; id: string; label: string; sources: SourceReference[]; explicitOrder?: string[] };
export type ReportBlock =
  | { type: "heading"; id: string; level: number; text: string; sectionId?: string; sectionKind?: SectionKind; priority?: PriorityLevel }
  | { type: "paragraph"; id: string; inlines: InlineElement[]; sectionId?: string; priority?: PriorityLevel }
  | { type: "list"; id: string; ordered: boolean; items: ListItem[]; sectionId?: string; priority?: PriorityLevel }
  | { type: "separator"; id: string }
  | SourceSectionBlock
  | { type: "priority"; id: string; level: "important" | "warning" | "urgent"; content: ReportBlock[]; sectionId?: string }
  | { type: "fallback"; id: string; text: string; diagnosticCodes: DiagnosticCode[] };
export type SourceSnapshot = { text: string | null; isPresent: boolean; isWhitespaceOnly: boolean };
export type ClinicalReportInput = { source: string | null | undefined; metadata?: ClinicalReportMetadata; safeLinkPolicy?: SafeLinkPolicy; safeLinkContext?: SafeLinkResolutionContext; upstreamError?: { code?: string; message: string } | null };
export type ClinicalReportIR = { state: "empty" | "error" | "fallback" | "ready"; source: SourceSnapshot; metadata: ClinicalReportMetadata; diagnostics: ParserDiagnostic[]; blocks: ReportBlock[] };
