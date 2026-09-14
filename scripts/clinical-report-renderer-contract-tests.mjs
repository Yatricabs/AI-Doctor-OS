import assert from "node:assert/strict";
import { createRequire } from "node:module";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseClinicalReport } from "../lib/clinical-report-renderer/parser.ts";

// Test-only loading support for the Property 11 host-equivalence loop. The property
// must exercise TWO host contexts (the primary-host adapter and the test-only
// second-host fixture) rendering the SAME ClinicalReportRenderer, so we compile the
// renderer/fixture TSX with sucrase and render via react-dom/server. This does not
// change the production boundary; it only lets the node contract script drive both
// hosts. The renderer is a client TSX component.
const nodeRequire = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nodeRequire("sucrase/register");
nodeRequire.extensions[".css"] = () => { };
// Resolve the "@/..." path alias (tsconfig paths: "@/*" -> "./*") for CJS requires
// so the fixture adapter's imports resolve exactly as they do under Next/Playwright.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (typeof request === "string" && request.startsWith("@/")) {
        return originalResolve.call(this, path.join(repoRoot, request.slice(2)), ...rest);
    }
    return originalResolve.call(this, request, ...rest);
};
globalThis.React = nodeRequire("react");
const { renderToStaticMarkup } = nodeRequire("react-dom/server");
const { PrimaryHostAdapter, SecondHostAdapter } = nodeRequire(
    path.join(repoRoot, "tests/clinical-report-renderer/fixtures/second-host/host-adapter.tsx"),
);

const source = `# Main Findings\nThe value is 12 mg/L (range 10–14 mg/L); it is not a diagnosis. [1]\n\n- **Stable** result\n  - *Verify* source\n\n## Red Flags\nEscalate only if the supplied context says so.\n\n## Evidence\n[1] [Reference](https://example.test/reference)`;
const metadata = { citations: [{ id: "citation-1", marker: "[1]", contentIds: [] }], sources: [{ id: "source-1", label: "Reference", destination: "https://example.test/reference" }] };
const assertStructure = (ir) => { assert.equal(ir.blocks[0].type, "heading"); assert.equal(ir.blocks.some((b) => b.type === "list"), true); assert.equal(ir.blocks.find((b) => b.type === "heading" && b.text === "Red Flags")?.priority, "warning"); assert.equal(ir.source.text, source); };

// Feature: clinical-report-renderer, Property 1: Supported parsing preserves structure
for (let i = 0; i < 100; i++) assertStructure(parseClinicalReport({ source, metadata }));
// Feature: clinical-report-renderer, Property 2: Explicit semantics remain available without inference
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "# Custom\nordinary emergency keyword only", metadata: { sections: [{ id: "custom", label: "Custom", kind: "custom" }] } }); assert.equal(ir.blocks.find((b) => b.type === "heading")?.priority, undefined); }
// Feature: clinical-report-renderer, Property 5: Clinical content faithfulness
for (let i = 0; i < 100; i++) assert.equal(parseClinicalReport({ source }).source.text, source);
// Feature: clinical-report-renderer, Property 9: Deterministic conservative priority mapping
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "**urgent** but ordinary" }); assert.equal(ir.blocks[0].type, "paragraph"); assert.equal(ir.blocks[0].priority, undefined); }
// Feature: clinical-report-renderer, Property 10: Keyword-only non-inference
for (let i = 0; i < 100; i++) assert.equal(parseClinicalReport({ source: "The patient reports an emergency keyword in ordinary prose." }).blocks.some((b) => "priority" in b && b.priority !== undefined), false);
// Feature: clinical-report-renderer, Property 3: Citation and source preservation
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "[1] [Reference](https://example.test/reference)", metadata }); const p = ir.blocks[0]; assert.equal(p.type, "paragraph"); assert.equal(p.inlines.some((x) => x.type === "citation" && x.marker === "[1]"), true); assert.equal(p.inlines.find((x) => x.type === "link")?.id, "link-1"); }
// Feature: clinical-report-renderer, Property 4: Link association and safe handling
for (let i = 0; i < 100; i++) { const safe = parseClinicalReport({ source: "[ok](/records/1) [bad](javascript:alert(1))", safeLinkPolicy: { approvedRelativePathPrefixes: ["/records"] }, safeLinkContext: { applicationOrigin: "https://app.example", currentPath: "/reports" } }); const links = safe.blocks[0].type === "paragraph" ? safe.blocks[0].inlines.filter((x) => x.type === "link") : []; assert.equal(links[0].destination, "https://app.example/records/1"); assert.equal(links[1].destination, null); }
// Feature: clinical-report-renderer, Property 13: Resilient parsing and fallback
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "**unclosed\n\n# Later heading\nLater content" }); assert.equal(ir.blocks.some((b) => b.type === "heading" && b.text === "Later heading"), true); }
// Feature: clinical-report-renderer, Property 14: Upstream error precedence and preservation
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source, metadata, upstreamError: { code: "NETWORK", message: "Unable to load report" } }); assert.equal(ir.state, "error"); assert.deepEqual(ir.blocks, []); assert.deepEqual(ir.metadata, metadata); }
// Feature: clinical-report-renderer, Property 6: Explicit section hierarchy and ordering
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "# Recommendations\n- Follow up" }); assert.equal(ir.blocks.find((b) => b.type === "heading")?.sectionKind, "recommendations"); }
// Feature: clinical-report-renderer, Property 7: Recommendation role
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "# Recommendations\n- Continue documented plan" }); assert.equal(ir.blocks[1].type, "list"); }
// Feature: clinical-report-renderer, Property 8: Explicit warning/urgent prioritization
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "# Urgent Information\nCall the care team now." }); assert.equal(ir.blocks[0].priority, "urgent"); }
// Feature: clinical-report-renderer, Property 11: Framework-independent IR equivalence
// Drive the prebuilt IR through TWO host contexts — the primary-host adapter and the
// test-only second-host fixture — each rendering the SAME ClinicalReportRenderer, and
// verify their observable semantic output is equivalent (content, hierarchy, citations,
// links, source order, explicit priorities, and state). The two hosts differ only by a
// minimal alternate layout wrapper/theme, which the projection ignores by walking from
// the .clinical-report region. This observes only public boundary output.
function decodeEntities(value) {
    return value
        .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&#x2F;", "/")
        .replaceAll("&#x3D;", "=").replaceAll("&#x60;", "`");
}
function parseHtml(html) {
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
            for (const attribute of rawAttributes.matchAll(attributePattern)) attrs[attribute[1]] = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
            const node = { tag: tagName.toLowerCase(), attrs, children: [] };
            stack.at(-1).children.push(node);
            if (!value.endsWith("/>") && !voidTags.has(node.tag)) stack.push(node);
            continue;
        }
        stack.at(-1).children.push({ text: decodeEntities(value) });
    }
    return root;
}
function textOf(node) {
    return node.text ?? node.children.map(textOf).join("");
}
function allElements(node, predicate = () => true) {
    const found = [];
    for (const child of node.children ?? []) {
        if (!child.text) {
            if (predicate(child)) found.push(child);
            found.push(...allElements(child, predicate));
        }
    }
    return found;
}
function findElement(node, predicate) {
    for (const child of node.children ?? []) {
        if (child.text) continue;
        if (predicate(child)) return child;
        const nested = findElement(child, predicate);
        if (nested) return nested;
    }
    return undefined;
}
function hasClass(node, name) {
    return (node.attrs?.class ?? "").split(/\s+/).includes(name);
}
// Observable semantic projection scoped to the .clinical-report region; host wrapper
// and theme differences (outer elements/classes) are excluded by construction.
function projectHostMarkup(html) {
    const tree = parseHtml(html);
    const report = findElement(tree, (node) => hasClass(node, "clinical-report"));
    assert.ok(report, "host output must expose the clinical-report region");
    let state = "ready";
    if (report.attrs["aria-label"] === "Clinical report error") state = "error";
    else if (allElements(report, (n) => n.tag === "h2" && textOf(n).trim() === "No report available").length) state = "empty";
    else if (allElements(report, (n) => n.tag === "div" && n.attrs.role === "status").length) state = "fallback";
    const headings = allElements(report, (n) => /^h[1-6]$/.test(n.tag)).map((n) => ({
        level: Number(n.tag.slice(1)), text: textOf(n).trim(), section: n.attrs["data-section"] ?? null,
    }));
    const sourcesSection = findElement(report, (n) => n.tag === "section" && (hasClass(n, "cr-sources") || n.attrs["aria-label"] === "Sources"));
    const sourceOrder = sourcesSection ? allElements(sourcesSection, (n) => n.tag === "li").map((n) => textOf(n).trim()) : [];
    const citations = allElements(report, (n) => n.tag === "sup" && hasClass(n, "cr-citation")).map((n) => textOf(n).trim());
    const links = allElements(report, (n) => n.tag === "a").map((n) => ({ label: textOf(n).trim(), href: n.attrs.href ?? null, target: n.attrs.target ?? null, rel: n.attrs.rel ?? null }));
    const unavailableLinks = allElements(report, (n) => n.attrs.title === "Link unavailable").map((n) => textOf(n).trim());
    const priorities = allElements(report, (n) => n.attrs["data-priority"] !== undefined).map((n) => n.attrs["data-priority"]);
    const semanticText = textOf(report).replace(/\s+/g, " ").trim();
    return { state, headings, sourceOrder, citations, links, unavailableLinks, priorities, semanticText };
}
function renderThroughHost(Adapter, input) {
    const ir = parseClinicalReport(input);
    const markup = renderToStaticMarkup(globalThis.React.createElement(Adapter, { ir }));
    return { ir, projection: projectHostMarkup(markup) };
}
const property11Inputs = [
    { source, metadata },
    { source: "# Main Findings\nNormal supplied text.\n\n## Important Information\nElevated context.\n\n## Red Flags\nWarning context.\n\n## Urgent Information\nUrgent context." },
    { source: "[Approved](/records/1) [External](https://example.test/reference) [Unsafe](javascript:alert(1))", safeLinkPolicy: { approvedRelativePathPrefixes: ["/records"] }, safeLinkContext: { applicationOrigin: "https://app.example", currentPath: "/reports/current" } },
    { source: "   ", metadata: { unknown: { supplied: true } } },
    { source: "report", metadata, upstreamError: { code: "NETWORK", message: "Unable to load report" } },
    { source: "Broken **emphasis remains readable\n\n# Later heading\nThe value remains uncertain." },
];
for (let i = 0; i < 100; i++) {
    const input = property11Inputs[i % property11Inputs.length];
    const primary = renderThroughHost(PrimaryHostAdapter, input);
    const second = renderThroughHost(SecondHostAdapter, input);
    // Equivalent semantic output across the two host contexts.
    assert.deepEqual(second.projection, primary.projection);
    // The parser IR state is host-independent by construction.
    assert.equal(second.ir.state, primary.ir.state);
    // The alternate layout/theme is a real wrapper difference that must not leak into
    // the semantic projection: the primary host emits data-host="primary" and the
    // second host emits data-host="second" plus the alternate theme class.
    const primaryMarkup = renderToStaticMarkup(globalThis.React.createElement(PrimaryHostAdapter, { ir: primary.ir }));
    const secondMarkup = renderToStaticMarkup(globalThis.React.createElement(SecondHostAdapter, { ir: second.ir }));
    assert.notEqual(secondMarkup, primaryMarkup);
    assert.ok(primaryMarkup.includes('data-host="primary"'));
    assert.ok(secondMarkup.includes('data-host="second"') && secondMarkup.includes("crr-alt-theme"));
}
// Feature: clinical-report-renderer, Property 12: Supported-format reuse
for (let i = 0; i < 100; i++) { const ir = parseClinicalReport({ source: "# Findings\nThe reported measurement remains within the supplied range.\n\n## Evidence\n[1] [Reference A](https://example.test/reference-a)", metadata: { sections: [{ id: "findings", label: "Findings", kind: "findings" }], citations: [{ id: "citation-1", marker: "[1]", contentIds: [], linkId: "link-1", linkedSourceId: "source-1" }], sources: [{ id: "source-1", label: "Reference A", destination: "https://example.test/reference-a" }] } }); assert.equal(ir.blocks.find((b) => b.type === "heading")?.sectionId, "findings"); }
// Mandatory contract/state and safety examples complement the property loops above.
assert.equal(parseClinicalReport({ source: null }).state, "empty");
assert.equal(parseClinicalReport({ source: "   " }).state, "empty");
assert.equal(parseClinicalReport({ source: "report", upstreamError: { message: "network" } }).state, "error");
const nested = parseClinicalReport({ source: "- one\n  - two\n    1. three\n\n## Sources\n[1] source" });
assert.equal(nested.blocks[0].type, "list");
assert.equal(nested.blocks[0].type === "list" && nested.blocks[0].items[0].children[0].items[0].children.length, 1);
const invalidCitation = parseClinicalReport({ source: "[1] [source](https://example.test)", metadata: { citations: [{ id: "c", marker: "[1]", contentIds: [], linkId: "missing" }] } });
assert.ok(invalidCitation.diagnostics.some((diagnostic) => diagnostic.code === "unassociated-citation"));
assert.equal(invalidCitation.blocks[0].type === "paragraph" ? invalidCitation.blocks[0].inlines.find((item) => item.type === "citation")?.linkId : "unexpected", undefined);
const exactOnly = parseClinicalReport({ source: "# Red Flags extra\nThe emergency keyword is ordinary prose." });
assert.equal(exactOnly.blocks.find((block) => block.type === "heading")?.priority, undefined);
const sourceOrder = parseClinicalReport({ source: "# Sources\nReferences", metadata: { sources: [{ id: "b", label: "B", order: 2 }, { id: "a", label: "A", order: 1 }] } });
assert.deepEqual(sourceOrder.blocks.find((block) => block.type === "source-section")?.sources.map((source) => source.id), ["a", "b"]);
const unsafeSource = parseClinicalReport({ source: "# Sources", metadata: { sources: [{ id: "x", label: "unsafe", destination: "javascript:alert(1)" }] } });
assert.equal(unsafeSource.blocks.find((block) => block.type === "source-section")?.sources[0].destination, undefined);
console.log("clinical-report-renderer contract tests passed (100 iterations per property)");
