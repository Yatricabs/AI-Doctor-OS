import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The renderer is a client TSX component. This is test-only loading support; it
// does not add a runtime renderer adapter or change the production boundary.
require("sucrase/register");
require.extensions[".css"] = () => { };
globalThis.React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { default: ClinicalReportRenderer } = require(path.join(root, "components/clinical-report-renderer/ClinicalReportRenderer.tsx"));
const { parseClinicalReport } = require(path.join(root, "lib/clinical-report-renderer/parser.ts"));

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function decode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#x2F;", "/")
    .replaceAll("&#x3D;", "=")
    .replaceAll("&#x60;", "`");
}

function parseObservableHtml(html) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const tokenPattern = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g;
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

  for (const token of html.matchAll(tokenPattern)) {
    const value = token[0];
    if (value.startsWith("<!--")) continue;
    if (value.startsWith("</")) {
      const tag = value.slice(2, -1).trim().toLowerCase();
      while (stack.length > 1 && stack.at(-1).tag !== tag) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (value.startsWith("<")) {
      const match = value.match(/^<([A-Za-z][\w:-]*)([^>]*)>$/);
      if (!match) continue;
      const [, tagName, rawAttributes] = match;
      const attrs = {};
      const attributePattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      for (const attribute of rawAttributes.matchAll(attributePattern)) {
        attrs[attribute[1]] = decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
      }
      const node = { tag: tagName.toLowerCase(), attrs, children: [] };
      stack.at(-1).children.push(node);
      if (!value.endsWith("/>") && !voidTags.has(node.tag)) stack.push(node);
      continue;
    }
    stack.at(-1).children.push({ text: decode(value) });
  }
  return root;
}

function textContent(node) {
  return node.text ?? node.children.map(textContent).join("");
}

function elements(node, predicate = () => true) {
  const found = [];
  for (const child of node.children ?? []) {
    if (!child.text && predicate(child)) found.push(child);
    if (!child.text) found.push(...elements(child, predicate));
  }
  return found;
}

function directElements(node, predicate = () => true) {
  return (node.children ?? []).filter((child) => !child.text && predicate(child));
}

function inlineProjection(node, counters) {
  const entries = [];
  const citationIds = [];
  const linkIds = [];
  const visit = (child) => {
    if (child.text) return;
    if (child.tag === "strong") {
      entries.push({ type: "strong", text: textContent(child) });
      return;
    }
    if (child.tag === "em") {
      entries.push({ type: "emphasis", text: textContent(child) });
      return;
    }
    if (child.tag === "sup" && (child.attrs["aria-label"] ?? "").startsWith("Citation ")) {
      const id = `citation-${++counters.citation}`;
      citationIds.push(id);
      entries.push({ type: "citation", text: textContent(child), citationIds: [id] });
      return;
    }
    if (child.tag === "a" || (child.tag === "span" && child.attrs.title === "Link unavailable")) {
      const id = `link-${++counters.link}`;
      linkIds.push(id);
      entries.push({ type: "link", text: textContent(child), linkIds: [id] });
      return;
    }
    for (const nested of child.children ?? []) visit(nested);
  };
  for (const child of node.children ?? []) visit(child);
  return { entries, citationIds, linkIds };
}

function directListItemText(item) {
  return item.children
    .filter((child) => child.text || (child.tag !== "ul" && child.tag !== "ol"))
    .map(textContent)
    .join("")
    .trim();
}

function projectList(node, sectionId, depth, projection, counters) {
  const items = directElements(node, (child) => child.tag === "li");
  const inline = { entries: [], citationIds: [], linkIds: [] };
  for (const item of items) {
    const itemInline = inlineProjection({ children: item.children.filter((child) => child.text || (child.tag !== "ul" && child.tag !== "ol")) }, counters);
    inline.entries.push(...itemInline.entries);
    inline.citationIds.push(...itemInline.citationIds);
    inline.linkIds.push(...itemInline.linkIds);
  }
  projection.blocks.push({
    type: "list",
    text: items.map(directListItemText).filter(Boolean).join("\n"),
    level: depth,
    ...(sectionId ? { sectionId } : {}),
    ...(inline.citationIds.length ? { citationIds: inline.citationIds } : {}),
    ...(inline.linkIds.length ? { linkIds: inline.linkIds } : {}),
  });
  projection.blocks.push(...inline.entries);
  for (const item of items) {
    for (const child of directElements(item, (candidate) => candidate.tag === "ul" || candidate.tag === "ol")) {
      projectList(child, sectionId, depth + 1, projection, counters);
    }
  }
}

function projectRendererOutput(html) {
  const tree = parseObservableHtml(html);
  const host = tree.children.find((child) => !child.text && (child.attrs?.["aria-label"] === "Clinical report" || child.attrs?.["aria-label"] === "Clinical report error"));
  assert.ok(host, "renderer output must expose the clinical-report host");
  const projection = { state: "ready", blocks: [], sourceOrder: [], diagnostics: [] };

  if (host.attrs["aria-label"] === "Clinical report error") projection.state = "error";
  else if (elements(host, (child) => child.tag === "h2" && textContent(child) === "No report available").length) projection.state = "empty";
  else if (elements(host, (child) => child.tag === "div" && child.attrs.role === "status").length) projection.state = "fallback";

  const counters = { citation: 0, link: 0 };
  const visitChildren = (parent, sectionId = undefined) => {
    for (const child of directElements(parent)) {
      if (child.tag === "div" && child.attrs.role === "status") {
        projection.diagnostics.push(textContent(child));
        continue;
      }
      if (/^h[1-6]$/.test(child.tag)) {
        const nextSection = child.attrs["data-section"] || sectionId;
        projection.blocks.push({
          type: "heading",
          text: textContent(child),
          level: Number(child.tag.slice(1)),
          ...(nextSection ? { sectionId: nextSection } : {}),
          ...(child.attrs["data-priority"] ? { priority: child.attrs["data-priority"] } : {}),
        });
        // Headings are the observable section boundary used by the renderer.
        sectionId = nextSection;
        continue;
      }
      if (child.tag === "p" && directElements(child, (candidate) => candidate.tag === "span" && textContent(candidate) === "Readable source text").length) {
        projection.blocks.push({ type: "fallback", text: textContent(child) });
        continue;
      }
      if (child.tag === "p") {
        const inline = inlineProjection(child, counters);
        projection.blocks.push({
          type: "paragraph",
          text: textContent(child),
          ...(sectionId ? { sectionId } : {}),
          ...(inline.citationIds.length ? { citationIds: inline.citationIds } : {}),
          ...(inline.linkIds.length ? { linkIds: inline.linkIds } : {}),
        });
        projection.blocks.push(...inline.entries);
        continue;
      }
      if (child.tag === "ul" || child.tag === "ol") {
        projectList(child, sectionId, 0, projection, counters);
        continue;
      }
      if (child.tag === "hr") {
        projection.blocks.push({ type: "separator", text: "" });
        continue;
      }
      if (child.tag === "section" && directElements(child, (candidate) => /^h[1-6]$/.test(candidate.tag)).length && directElements(child, (candidate) => candidate.tag === "ol" || candidate.tag === "ul").length) {
        const sourceHeading = directElements(child, (candidate) => /^h[1-6]$/.test(candidate.tag))[0];
        const list = directElements(child, (candidate) => candidate.tag === "ol" || candidate.tag === "ul")[0];
        const sourceItems = list ? directElements(list, (candidate) => candidate.tag === "li") : [];
        projection.blocks.push({ type: "source-section", text: sourceHeading ? textContent(sourceHeading) : textContent(child), ...(sectionId ? { sectionId } : {}) });
        projection.sourceOrder.push(...sourceItems.map(textContent));
        continue;
      }
      if (child.tag === "section" && child.attrs["data-priority"]) {
        const priority = child.attrs["data-priority"];
        projection.blocks.push({ type: "priority", text: textContent(child), ...(priority ? { priority } : {}), ...(sectionId ? { sectionId } : {}) });
        const label = directElements(child, (candidate) => candidate.tag === "p" && /^(?:Note:|Warning:|!\s+Urgent information)/.test(textContent(candidate)))[0];
        visitChildren({ children: directElements(child).filter((candidate) => candidate !== label) }, sectionId);
        continue;
      }
      if (child.tag === "div" && directElements(child, (candidate) => candidate.tag === "h2" && (textContent(candidate) === "No report available" || textContent(candidate) === "Report unavailable")).length) {
        if (projection.state === "error") projection.diagnostics.push(textContent(child));
        continue;
      }
      visitChildren(child, sectionId);
    }
  };

  if (projection.state === "empty" || projection.state === "error") {
    visitChildren(host);
  } else {
    visitChildren(host);
  }
  return projection;
}

function render(ir) {
  return renderToStaticMarkup(require("react").createElement(ClinicalReportRenderer, { ir }));
}

function boundary(input) {
  const ir = parseClinicalReport(input);
  const html = render(ir);
  return { input, ir, html, projection: projectRendererOutput(html) };
}

const reportSource = `# Main Findings
The value is 12 mg/L (range 10–14 mg/L); it is not a diagnosis. [1]

- **Stable** result
  - *Verify* source

---

## Recommendations
- Continue the documented follow-up plan; do not add an instruction.

## Evidence
[1] [Reference A](https://example.test/reference-a)`;
const reportMetadata = {
  sections: [
    { id: "findings", label: "Main Findings", kind: "findings" },
    { id: "recommendations", label: "Recommendations", kind: "recommendations" },
    { id: "evidence", label: "Evidence", kind: "sources" },
  ],
  citations: [{ id: "citation-1", marker: "[1]", contentIds: [], linkId: "link-1", linkedSourceId: "source-a" }],
  sources: [
    { id: "source-b", label: "Reference B", destination: "https://example.test/reference-b", order: 2 },
    { id: "source-a", label: "Reference A", destination: "https://example.test/reference-a", citationIds: ["citation-1"], order: 1 },
  ],
  unknown: { futureFlag: "must remain inert" },
};

const sourceStateSummary = (ir) => ({ source: ir.source, metadata: ir.metadata, diagnostics: ir.diagnostics.map((diagnostic) => ({ ...diagnostic })) });

test("ready output preserves semantic blocks, inline roles, order, nesting, recommendations, citations, and qualifiers", () => {
  const result = boundary({ source: reportSource, metadata: reportMetadata });
  assert.equal(result.ir.state, "ready");
  assert.equal(result.projection.state, "ready");
  // The corrected parser splice-REPLACES the parsed "## Evidence" heading with the
  // source-section block (which renders its own heading), so there is no separate
  // standalone 'heading' preceding 'source-section' for the Evidence section.
  assert.deepEqual(result.projection.blocks.filter((block) => ["heading", "paragraph", "list", "separator", "source-section"].includes(block.type)).map((block) => block.type), ["heading", "paragraph", "list", "list", "separator", "heading", "list", "source-section", "paragraph"]);
  // Standalone headings are now Main Findings (h1) and Recommendations (h2). The
  // Evidence section's heading is rendered exactly once by the source-section
  // block, not duplicated as a separate preceding 'heading'.
  assert.deepEqual(result.projection.blocks.filter((block) => block.type === "heading").map((block) => block.level), [1, 2]);
  const sourceSections = result.projection.blocks.filter((block) => block.type === "source-section");
  assert.equal(sourceSections.length, 1);
  assert.equal(sourceSections[0].text, "Evidence");
  assert.equal(result.projection.blocks.filter((block) => block.type === "heading" && block.text === "Evidence").length, 0);
  assert.equal(result.projection.blocks.find((block) => block.type === "heading" && block.text === "Recommendations").sectionId, "recommendations");
  assert.equal(result.projection.blocks.find((block) => block.type === "list" && block.sectionId === "recommendations").priority, undefined);
  assert.deepEqual(result.projection.blocks.filter((block) => block.type === "list").map((block) => block.level), [0, 1, 0]);
  assert.match(result.projection.blocks.find((block) => block.type === "list" && block.level === 0).text, /Stable result/);
  assert.match(result.projection.blocks.find((block) => block.type === "list" && block.level === 1).text, /Verify source/);
  assert.ok(result.projection.blocks.some((block) => block.type === "strong" && block.text === "Stable"));
  assert.ok(result.projection.blocks.some((block) => block.type === "emphasis" && block.text === "Verify"));
  const citedParagraph = result.projection.blocks.find((block) => block.type === "paragraph" && block.text.includes("12 mg/L"));
  assert.ok(citedParagraph);
  assert.match(citedParagraph.text, /range 10–14 mg\/L/);
  assert.match(citedParagraph.text, /not a diagnosis/);
  const evidenceParagraph = result.projection.blocks.find((block) => block.type === "paragraph" && block.text.includes("Reference A"));
  assert.equal(evidenceParagraph.citationIds.length, 1);
  assert.deepEqual(evidenceParagraph.linkIds, ["link-1"]);
  assert.ok(result.projection.blocks.some((block) => block.type === "citation" && block.text === "[1]"));
  assert.ok(result.projection.blocks.some((block) => block.type === "link" && block.text === "Reference A"));
  assert.deepEqual(result.projection.sourceOrder, ["Reference A", "Reference B"]);
  assert.deepEqual(result.ir.metadata.sources.map((source) => source.id), ["source-b", "source-a"]);
  assert.deepEqual(result.ir.metadata.citations[0], reportMetadata.citations[0]);
  assert.equal(result.ir.metadata.unknown.futureFlag, "must remain inert");
  assert.equal(result.html.includes("12 mg/L"), true);
  assert.equal(result.html.includes("diagnosis"), true);
});

test("ready explicit priority IR is visible with text cues and preserves exact warning/urgent content", () => {
  const base = parseClinicalReport({ source: "Urgent supplied explanation.\nWarning supplied explanation." });
  const urgentText = "Call the care team now; this is the supplied urgent qualification.";
  const warningText = "Review the supplied warning context before acting.";
  const ir = {
    ...base,
    blocks: [
      { type: "priority", id: "priority-warning", level: "warning", content: [{ type: "paragraph", id: "warning-content", inlines: [{ type: "text", text: warningText }], sectionId: "red-flags" }], sectionId: "red-flags" },
      { type: "priority", id: "priority-urgent", level: "urgent", content: [{ type: "paragraph", id: "urgent-content", inlines: [{ type: "text", text: urgentText }], sectionId: "urgent" }], sectionId: "urgent" },
    ],
  };
  const result = { ir, html: render(ir) };
  result.projection = projectRendererOutput(result.html);
  const priorityBlocks = result.projection.blocks.filter((block) => block.type === "priority");
  assert.deepEqual(priorityBlocks.map((block) => block.priority), ["warning", "urgent"]);
  assert.match(priorityBlocks[0].text, /Review the supplied warning context/);
  assert.match(priorityBlocks[1].text, /Call the care team now/);
  assert.match(result.html, /Warning:/);
  assert.match(result.html, /Urgent information/);
  assert.match(result.html, /Call the care team now; this is the supplied urgent qualification\./);
  assert.match(result.html, /Review the supplied warning context before acting\./);
});

test("empty state is non-clinical and does not fabricate blocks or findings", () => {
  const result = boundary({ source: "   ", metadata: { unknown: { supplied: true } } });
  assert.equal(result.ir.state, "empty");
  assert.equal(result.projection.state, "empty");
  assert.deepEqual(result.projection.blocks, []);
  assert.match(result.html, /No report available/);
  assert.match(result.html, /No clinical report content was supplied\./);
  assert.doesNotMatch(result.html, /finding|recommendation|warning|urgent|emergency|diagnosis/i);
  assert.deepEqual(sourceStateSummary(result.ir), { source: { text: "   ", isPresent: true, isWhitespaceOnly: true }, metadata: { unknown: { supplied: true } }, diagnostics: [] });
});

test("error state takes precedence over source and is diagnostic-only", () => {
  const result = boundary({ source: "A source finding must not be presented as a clinical report.", metadata: reportMetadata, upstreamError: { code: "UPSTREAM_TIMEOUT", message: "Unable to load the upstream report." } });
  assert.equal(result.ir.state, "error");
  assert.equal(result.projection.state, "error");
  assert.deepEqual(result.ir.blocks, []);
  assert.deepEqual(result.ir.source, { text: "A source finding must not be presented as a clinical report.", isPresent: true, isWhitespaceOnly: false });
  assert.deepEqual(result.ir.metadata, reportMetadata);
  assert.deepEqual(result.ir.diagnostics.map((diagnostic) => diagnostic.code), ["upstream-error"]);
  assert.match(result.html, /Unable to load the upstream report\./);
  assert.match(result.html, /No clinical content was presented\./);
  assert.doesNotMatch(result.html, /A source finding must not be presented/);
  assert.deepEqual(result.projection.blocks, []);
});

test("fallback keeps malformed readable text, later structure, diagnostics, and source fidelity", () => {
  const malformedSource = "Broken **emphasis remains readable\n\n# Later heading\nThe value remains uncertain (range 2–4 mg/L).";
  const result = boundary({ source: malformedSource, metadata: { unknown: { source: "preserve" } } });
  assert.equal(result.ir.state, "fallback");
  assert.equal(result.projection.state, "fallback");
  assert.ok(result.ir.diagnostics.some((diagnostic) => diagnostic.code === "malformed-markdown"));
  assert.ok(result.projection.blocks.some((block) => block.type === "heading" && block.text === "Later heading"));
  assert.ok(result.projection.blocks.some((block) => block.type === "paragraph" && block.text.includes("Broken **emphasis remains readable")));
  assert.ok(result.projection.blocks.some((block) => block.type === "paragraph" && block.text.includes("range 2–4 mg/L")));
  assert.match(result.html, /Some formatting could not be interpreted/);
  assert.deepEqual(result.ir.metadata.unknown, { source: "preserve" });
  assert.equal(result.ir.source.text, malformedSource);
});

test("unknown metadata is preserved but cannot fabricate rendered content", () => {
  const metadata = { unknown: { futurePriority: "urgent", generatedText: "not report content" }, futureField: { kind: "unsupported" } };
  const result = boundary({ source: "Ordinary report wording only.", metadata });
  assert.equal(result.ir.state, "ready");
  assert.deepEqual(result.ir.metadata, metadata);
  assert.equal(result.projection.state, "ready");
  assert.ok(result.projection.blocks.some((block) => block.type === "paragraph" && block.text === "Ordinary report wording only."));
  assert.equal(result.projection.blocks.some((block) => block.priority), false);
  assert.doesNotMatch(result.html, /not report content|futurePriority|unsupported/);
});

test("ordinary alarming keywords do not gain a priority role", () => {
  const source = "The word emergency appears in ordinary prose, while warning is discussed as a label only.";
  const result = boundary({ source });
  assert.equal(result.ir.state, "ready");
  assert.ok(result.projection.blocks.some((block) => block.type === "paragraph" && block.text === source));
  assert.equal(result.projection.blocks.some((block) => block.priority), false);
  assert.doesNotMatch(result.html, /Urgent information|Red flag|Important information/);
});

test("bold and emphasis remain observable styling-only inline roles", () => {
  const source = "**urgent** and *warning* are words, not supplied priority metadata.";
  const result = boundary({ source });
  assert.equal(result.ir.state, "ready");
  assert.ok(result.projection.blocks.some((block) => block.type === "strong" && block.text === "urgent"));
  assert.ok(result.projection.blocks.some((block) => block.type === "emphasis" && block.text === "warning"));
  assert.equal(result.projection.blocks.some((block) => block.priority), false);
  assert.match(result.html, /<strong>urgent<\/strong>/);
  assert.match(result.html, /<em>warning<\/em>/);
});

test("safe-link output preserves approved associations and neutralizes unsafe or unavailable destinations", () => {
  const source = "[Approved](/records/1) [External](https://example.test/reference) [Unsafe](javascript:alert(1)) [Outside](/outside/2)";
  const result = boundary({ source, safeLinkPolicy: { approvedRelativePathPrefixes: ["/records"] }, safeLinkContext: { applicationOrigin: "https://app.example", currentPath: "/reports/current" } });
  const tree = parseObservableHtml(result.html);
  const anchors = elements(tree, (node) => node.tag === "a");
  const unsafe = elements(tree, (node) => node.tag === "span" && node.attrs.title === "Link unavailable");
  assert.equal(anchors.length, 2);
  assert.deepEqual(anchors.map((anchor) => ({ label: textContent(anchor), href: anchor.attrs.href, target: anchor.attrs.target, rel: anchor.attrs.rel })), [
    { label: "Approved", href: "https://app.example/records/1", target: "_blank", rel: "noopener noreferrer" },
    { label: "External", href: "https://example.test/reference", target: "_blank", rel: "noopener noreferrer" },
  ]);
  assert.deepEqual(unsafe.map(textContent), ["Unsafe", "Outside"]);
  assert.equal(unsafe.some((node) => node.attrs.href), false);
  const noPolicy = boundary({ source: "[No policy](/records/2)" });
  const noPolicyTree = parseObservableHtml(noPolicy.html);
  assert.equal(elements(noPolicyTree, (node) => node.tag === "a").length, 0);
  assert.deepEqual(elements(noPolicyTree, (node) => node.tag === "span" && node.attrs.title === "Link unavailable").map(textContent), ["No policy"]);
  assert.ok(result.ir.diagnostics.filter((diagnostic) => diagnostic.code === "invalid-link").length >= 2);
  assert.ok(result.projection.blocks.some((block) => block.type === "link" && block.text === "Approved"));
  assert.ok(result.projection.blocks.some((block) => block.type === "link" && block.text === "Unsafe"));
});

test("report text is emitted as text data rather than executable markup", () => {
  const source = "<script>alert('xss')</script> & preserve this wording.";
  const result = boundary({ source });
  assert.equal(result.projection.state, "ready");
  assert.doesNotMatch(result.html, /<script>/i);
  assert.match(result.html, /&lt;script&gt;alert/);
  assert.ok(result.projection.blocks.some((block) => block.type === "paragraph" && block.text.includes("<script>alert('xss')</script>")));
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}
if (failures) {
  process.exitCode = 1;
  console.error(`${failures} renderer semantic/state test(s) failed.`);
} else {
  console.log(`${tests.length} renderer semantic/state tests passed.`);
}
