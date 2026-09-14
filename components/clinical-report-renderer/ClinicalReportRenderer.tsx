"use client";
import type { ClinicalReportIR, InlineElement, ListBlock, ReportBlock } from "@/lib/clinical-report-renderer/types";
import "./clinical-report-renderer.css";

function Inline({ items }: { items: InlineElement[] }) {
  return <>{items.map((item, index) => {
    if (item.type === "strong") return <strong key={index}>{item.text}</strong>;
    if (item.type === "emphasis") return <em key={index}>{item.text}</em>;
    if (item.type === "link") return item.safe && item.destination
      ? <a key={item.id} href={item.destination} target="_blank" rel="noopener noreferrer">{item.label}</a>
      : <span key={item.id} className="cr-unsafe-link" title="Link unavailable">{item.label}</span>;
    if (item.type === "citation") return <sup key={item.id} className="cr-citation" aria-label={`Citation ${item.marker}`}>{item.marker}</sup>;
    return <span key={index}>{item.text}</span>;
  })}</>;
}

function List({ list }: { list: ListBlock }) {
  const Tag = list.ordered ? "ol" : "ul";
  return <Tag>{list.items.map((item) => <li key={item.id}>
    <Inline items={item.inlines} />
    {item.children.map((child, index) => <List key={`${item.id}-${index}`} list={child} />)}
  </li>)}</Tag>;
}

function priorityLabel(level: "important" | "warning" | "urgent") {
  return level === "urgent" ? "Urgent information" : level === "warning" ? "Red flag" : "Important information";
}
function priorityCue(level: "important" | "warning" | "urgent") {
  return level === "urgent" ? "!" : level === "warning" ? "Warning:" : "Note:";
}
function Priority({ block }: { block: Extract<ReportBlock, { type: "priority" }> }) {
  const label = priorityLabel(block.level);
  return <section className={`cr-priority cr-priority-${block.level}`} aria-label={label} data-priority={block.level}>
    <p className="cr-priority-label"><span aria-hidden="true">{priorityCue(block.level)}</span> {label}</p>
    {block.content.map((child) => <Block key={child.id} block={child} />)}
  </section>;
}

function PriorityBlock({ block, children }: { block: ReportBlock & { priority: "important" | "warning" | "urgent" }; children: React.ReactNode }) {
  const label = priorityLabel(block.priority);
  return <section className={`cr-priority cr-priority-${block.priority}`} aria-label={label} data-priority={block.priority}>
    <p className="cr-priority-label"><span aria-hidden="true">{priorityCue(block.priority)}</span> {label}</p>{children}
  </section>;
}

function Block({ block }: { block: ReportBlock }) {
  if (block.type === "heading") {
    const Tag = (`h${Math.min(6, Math.max(1, block.level))}`) as keyof JSX.IntrinsicElements;
    return <Tag id={block.id} className={`cr-heading ${block.priority ? `cr-priority-text-${block.priority}` : ""}`} data-section={block.sectionKind}>{block.text}</Tag>;
  }
  if (block.type === "paragraph") {
    const content = <p><Inline items={block.inlines} /></p>;
    return block.priority && block.priority !== "normal" ? <PriorityBlock block={block as typeof block & { priority: "important" | "warning" | "urgent" }}>{content}</PriorityBlock> : content;
  }
  if (block.type === "list") {
    const content = <List list={{ ordered: block.ordered, items: block.items }} />;
    return block.priority && block.priority !== "normal" ? <PriorityBlock block={block as typeof block & { priority: "important" | "warning" | "urgent" }}>{content}</PriorityBlock> : content;
  }
  if (block.type === "separator") return <hr aria-hidden="true" />;
  if (block.type === "fallback") return <p className="cr-fallback"><span className="cr-fallback-label">Readable source text</span>{block.text}</p>;
  if (block.type === "source-section") return <section className="cr-sources" aria-labelledby={block.id}>
    <h2 id={block.id}>{block.label}</h2>
    <ol>{block.sources.map((source) => <li key={source.id}>{source.destination
      ? <a href={source.destination} target="_blank" rel="noopener noreferrer">{source.label}</a>
      : <span>{source.label}</span>}</li>)}</ol>
  </section>;
  return <Priority block={block} />;
}

export default function ClinicalReportRenderer({ ir, className = "" }: { ir: ClinicalReportIR; className?: string }) {
  if (ir.state === "empty") return <section className={`clinical-report ${className}`} aria-label="Clinical report"><div className="cr-state"><h2>No report available</h2><p>No clinical report content was supplied.</p></div></section>;
  if (ir.state === "error") return <section className={`clinical-report ${className}`} aria-label="Clinical report error"><div className="cr-state cr-state-error"><h2>Report unavailable</h2><p>{ir.diagnostics.find((diagnostic) => diagnostic.code === "upstream-error")?.message ?? "The report could not be loaded."}</p><p className="cr-state-note">No clinical content was presented.</p></div></section>;
  return <article className={`clinical-report ${className}`} aria-label="Clinical report">
    {ir.state === "fallback" && <div className="cr-fallback-banner" role="status">Some formatting could not be interpreted; the report text is shown faithfully.</div>}
    {ir.blocks.map((block) => <Block key={block.id} block={block} />)}
    {ir.metadata.sources?.length && !ir.blocks.some((block) => block.type === "source-section") ? <section className="cr-sources" aria-label="Sources"><h2>Sources</h2><ol>{ir.metadata.sources.map((source) => <li key={source.id}>{source.destination ? <a href={source.destination} target="_blank" rel="noopener noreferrer">{source.label}</a> : source.label}</li>)}</ol></section> : null}
  </article>;
}
