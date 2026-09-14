import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import Module from "node:module";
import path from "node:path";
import fs from "node:fs";

// Host-equivalence integration verification (Requirement 9.6, Property 11).
//
// This suite drives BOTH the primary-host adapter and the test-only second-host
// adapter from identical source/metadata/state inputs, renders the SAME
// ClinicalReportRenderer through each, and asserts their observable semantic
// output is equivalent. It also asserts that the second host's alternate layout
// wrapper/theme does NOT change semantic content, hierarchy, citations, links,
// source order, explicit priorities, or state behavior, and that both hosts add
// no fetcher/generator/workflow/route-policy/classifier and infer no safe-link
// policy/context. It follows the same module-loading/render approach as
// browser-verification.spec.ts and accessibility.spec.ts.
const testRequire = createRequire(path.join(process.cwd(), "tests/clinical-report-renderer/host-equivalence.spec.ts"));
testRequire.extensions[".css"] = () => undefined;
const ReactRuntime = testRequire("react") as typeof import("react");
(globalThis as Record<string, unknown>).React = ReactRuntime;
const { renderToStaticMarkup } = testRequire("react-dom/server") as typeof import("react-dom/server");
const { transform } = testRequire("sucrase") as typeof import("sucrase");

// Load TSX/TS with the classic JSX runtime so JSX compiles to real
// React.createElement (see browser-verification.spec.ts for the rationale). This
// is test-only module loading support; it does not alter the public boundary.
function loadTsModule(absolutePath: string): Record<string, unknown> {
  const source = fs.readFileSync(absolutePath, "utf8");
  const { code } = transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "classic",
    filePath: absolutePath,
  });
  const mod = new Module(absolutePath, module);
  mod.filename = absolutePath;
  mod.paths = (Module as unknown as { _nodeModulePaths(dir: string): string[] })._nodeModulePaths(path.dirname(absolutePath));
  const moduleRequire = mod.require.bind(mod) as NodeRequire;
  moduleRequire.extensions = testRequire.extensions;
  (mod as unknown as { _compile(code: string, filename: string): void })._compile(code, absolutePath);
  return mod.exports as Record<string, unknown>;
}

const { default: ClinicalReportRenderer } = loadTsModule(path.join(process.cwd(), "components/clinical-report-renderer/ClinicalReportRenderer.tsx")) as { default: unknown };
const { parseClinicalReport } = loadTsModule(path.join(process.cwd(), "lib/clinical-report-renderer/parser.ts")) as { parseClinicalReport: (...args: unknown[]) => unknown };
const hostAdapters = loadTsModule(path.join(process.cwd(), "tests/clinical-report-renderer/fixtures/second-host/host-adapter.tsx"));
const PrimaryHostAdapter = hostAdapters.PrimaryHostAdapter as ((props: { ir: unknown; options?: { className?: string } }) => unknown) & {
  hostName: string;
  capabilities: Record<string, boolean>;
};
const SecondHostAdapter = hostAdapters.SecondHostAdapter as typeof PrimaryHostAdapter;
const rendererCss = fs.readFileSync(path.join(process.cwd(), "components/clinical-report-renderer/clinical-report-renderer.css"), "utf8");

const APP_ORIGIN = "http://127.0.0.1:3000";
type ReportInput = Parameters<typeof parseClinicalReport>[0];
type HostAdapter = typeof PrimaryHostAdapter;

const profiles = [
  { name: "narrow 320 CSS px", viewport: { width: 320, height: 1000 } },
  { name: "wide 1440 CSS px", viewport: { width: 1440, height: 1000 } },
] as const;

// Identical inputs exercised by both hosts. Cover ready/empty/error/fallback,
// citations/sources/links/explicit priorities/hierarchy/source order.
const INPUTS: Array<{ name: string; input: ReportInput }> = [
  {
    name: "ready with citations, sources, links, hierarchy, explicit source order",
    input: {
      source: `# Main Findings\nThe value is 12 mg/L (range 10–14 mg/L); it is not a diagnosis. [1]\n\n- **Stable** result\n  - *Verify* source\n\n1. First ordered item\n2. Second ordered item\n\n---\n\n## Clinical Considerations\nThe supplied consideration remains exactly as written. [External](https://example.test/reference)\n\n## Recommendations\n- Continue the documented follow-up plan; do not add an instruction.\n\n## Evidence\n[1] [Reference A](https://example.test/reference-a)`,
      metadata: {
        citations: [{ id: "citation-1", marker: "[1]", contentIds: [], linkId: "link-1", linkedSourceId: "source-a" }],
        sources: [
          { id: "source-b", label: "Reference B", destination: "https://example.test/reference-b", order: 2 },
          { id: "source-a", label: "Reference A", destination: "https://example.test/reference-a", order: 1 },
        ],
      },
    },
  },
  {
    name: "ready with explicit priorities and no keyword inference",
    input: {
      source: `# Main Findings\nNormal supplied text.\n\n## Important Information\nElevated supplied context.\n\n## Red Flags\nWarning supplied context with its explanation.\n\n## Urgent Information\nUrgent supplied context with its qualification.\n\nThe word emergency appears in ordinary prose only.`,
    },
  },
  {
    name: "ready with safe-link policy/context supplied explicitly",
    input: {
      source: "[Approved](/records/1) [External](https://example.test/reference) [Unsafe](javascript:alert(1)) [Outside](/outside/2)",
      safeLinkPolicy: { approvedRelativePathPrefixes: ["/records"] },
      safeLinkContext: { applicationOrigin: APP_ORIGIN, currentPath: "/reports/current" },
    },
  },
  { name: "empty state", input: { source: "   ", metadata: { unknown: { supplied: true } } } },
  {
    name: "error state takes precedence over source",
    input: {
      source: "A source finding must remain diagnostic context only.",
      metadata: { unknown: { retained: true } },
      upstreamError: { code: "UPSTREAM_TIMEOUT", message: "Unable to load the upstream report." },
    },
  },
  {
    name: "fallback keeps malformed readable text and later structure",
    input: { source: "Broken **emphasis remains readable\n\n# Later heading\nThe value remains uncertain (range 2–4 mg/L)." },
  },
];

function renderHost(adapter: HostAdapter, input: ReportInput) {
  const ir = parseClinicalReport(input);
  // Inject the classic-runtime-compiled ClinicalReportRenderer so react-dom/server
  // can render it; both hosts render the SAME renderer instance.
  const markup = renderToStaticMarkup(ReactRuntime.createElement(adapter as never, { ir, Renderer: ClinicalReportRenderer }));
  return { ir, markup };
}

async function projectHost(page: Page, adapter: HostAdapter, input: ReportInput) {
  await page.goto("about:blank");
  const { ir, markup } = renderHost(adapter, input);
  await page.evaluate(({ markup, css }) => {
    document.body.innerHTML = "";
    document.body.className = "";
    document.body.style.cssText = "margin:0;background:#fff;color:#243b37;font-family:Arial,sans-serif;";
    const style = document.createElement("style");
    style.textContent = `${css}\n#clinical-report-equivalence-host{width:100%;box-sizing:border-box;padding:0;background:#fff;}`;
    const host = document.createElement("main");
    host.id = "clinical-report-equivalence-host";
    host.innerHTML = markup;
    document.head.append(style);
    document.body.append(host);
  }, { markup, css: rendererCss });

  // Extract an observable semantic projection from the rendered DOM. The walk
  // starts at .clinical-report, so the host wrapper/theme differences are ignored
  // by construction; only semantic content, hierarchy, regions, source order,
  // citations, links, priorities, and state are captured.
  const projection = await page.evaluate(() => {
    const report = document.querySelector(".clinical-report");
    if (!report) return null;
    const stateFromLabel = report.getAttribute("aria-label");
    let state: string = "ready";
    if (stateFromLabel === "Clinical report error") state = "error";
    else if (Array.from(report.querySelectorAll("h2")).some((h) => h.textContent?.trim() === "No report available")) state = "empty";
    else if (report.querySelector('[role="status"]')) state = "fallback";

    const headings = Array.from(report.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
      level: Number(h.tagName.slice(1)),
      text: (h.textContent ?? "").trim(),
      section: h.getAttribute("data-section") ?? null,
    }));

    // Source order: the source-section list items, in DOM order.
    const sourcesSection = Array.from(report.querySelectorAll("section")).find((s) =>
      s.classList.contains("cr-sources") || s.getAttribute("aria-label") === "Sources");
    const sourceOrder = sourcesSection
      ? Array.from(sourcesSection.querySelectorAll("li")).map((li) => (li.textContent ?? "").trim())
      : [];

    const citations = Array.from(report.querySelectorAll("sup.cr-citation")).map((c) => (c.textContent ?? "").trim());

    const links = Array.from(report.querySelectorAll("a")).map((a) => ({
      label: (a.textContent ?? "").trim(),
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel"),
    }));
    const unavailableLinks = Array.from(report.querySelectorAll('[title="Link unavailable"]')).map((n) => (n.textContent ?? "").trim());

    const priorities = Array.from(report.querySelectorAll("[data-priority]")).map((p) => p.getAttribute("data-priority"));
    const priorityHeadings = Array.from(report.querySelectorAll('[class*="cr-priority-text-"]')).map((h) => ({
      text: (h.textContent ?? "").trim(),
      className: (h.getAttribute("class") ?? "").split(/\s+/).filter((c) => c.startsWith("cr-priority-text-")).join(" "),
    }));

    // A normalized semantic text of the report region with whitespace collapsed.
    const semanticText = (report.textContent ?? "").replace(/\s+/g, " ").trim();

    return { state, headings, sourceOrder, citations, links, unavailableLinks, priorities, priorityHeadings, semanticText };
  });

  return { ir, projection };
}

for (const profile of profiles) {
  test.describe(`Clinical report host equivalence at ${profile.name}`, () => {
    test.use({ viewport: profile.viewport });

    for (const { name, input } of INPUTS) {
      test(`primary and second hosts produce equivalent semantic output — ${name}`, async ({ page }) => {
        const primary = await projectHost(page, PrimaryHostAdapter, input);
        const second = await projectHost(page, SecondHostAdapter, input);

        // Both hosts must expose a clinical-report region for every state.
        expect(primary.projection).not.toBeNull();
        expect(second.projection).not.toBeNull();

        // The observable semantic projections must be identical: state, headings,
        // hierarchy/section regions, source order, citations, links, priorities,
        // and semantic text. Layout wrapper/theme differences are excluded by
        // walking from .clinical-report.
        expect(second.projection).toEqual(primary.projection);

        // The IR (parser output) is host-independent by construction; confirm the
        // two hosts consumed equivalent IR state.
        expect((second.ir as { state: string }).state).toBe((primary.ir as { state: string }).state);
      });
    }

    test("wrapper/theme differs but semantic content, hierarchy, citations, links, source order, priorities, and state do not", async ({ page }) => {
      const input = INPUTS[0].input;
      const primary = await projectHost(page, PrimaryHostAdapter, input);

      // Confirm the second host's wrapper/theme is genuinely different at the DOM
      // level (alternate wrapper element + theme class), then confirm that
      // difference does not leak into the semantic projection.
      const secondRender = renderHost(SecondHostAdapter, input);
      const primaryRender = renderHost(PrimaryHostAdapter, input);
      expect(secondRender.markup).not.toEqual(primaryRender.markup);
      expect(secondRender.markup).toContain('data-host="second"');
      expect(secondRender.markup).toContain("crr-alt-theme");
      expect(primaryRender.markup).toContain('data-host="primary"');

      const second = await projectHost(page, SecondHostAdapter, input);
      expect(second.projection).toEqual(primary.projection);
      // Explicit checks on the equivalence-critical facets for this rich input.
      expect(second.projection?.headings).toEqual(primary.projection?.headings);
      expect(second.projection?.sourceOrder).toEqual(primary.projection?.sourceOrder);
      expect(second.projection?.citations).toEqual(primary.projection?.citations);
      expect(second.projection?.links).toEqual(primary.projection?.links);
      expect(second.projection?.priorities).toEqual(primary.projection?.priorities);
      expect(second.projection?.state).toEqual(primary.projection?.state);
    });

    test("both hosts register no fetcher/generator/workflow/route-policy/classifier and infer no safe-link policy/context", async () => {
      for (const adapter of [PrimaryHostAdapter, SecondHostAdapter]) {
        const caps = adapter.capabilities;
        expect(caps.registersFetcher).toBe(false);
        expect(caps.registersGenerator).toBe(false);
        expect(caps.registersWorkflowState).toBe(false);
        expect(caps.registersRoutePolicy).toBe(false);
        expect(caps.registersClinicalClassifier).toBe(false);
        expect(caps.rendersClinicalReportRenderer).toBe(true);
        expect(caps.infersSafeLinkPolicyOrContext).toBe(false);
      }

      // Both hosts receive explicit safe-link policy/context via the parser
      // boundary rather than inferring it: with an explicit policy/context the
      // approved relative link resolves against the supplied origin, and with no
      // policy/context supplied the same relative link is non-actionable.
      const withPolicy = parseClinicalReport({
        source: "[Approved](/records/1)",
        safeLinkPolicy: { approvedRelativePathPrefixes: ["/records"] },
        safeLinkContext: { applicationOrigin: APP_ORIGIN, currentPath: "/reports/current" },
      }) as { blocks: Array<{ type: string; inlines?: Array<{ type: string; safe?: boolean; destination?: string | null }> }> };
      const withPolicyLink = withPolicy.blocks[0].inlines?.find((i) => i.type === "link");
      expect(withPolicyLink?.safe).toBe(true);
      expect(withPolicyLink?.destination).toBe(`${APP_ORIGIN}/records/1`);

      const noPolicy = parseClinicalReport({ source: "[Approved](/records/1)" }) as typeof withPolicy;
      const noPolicyLink = noPolicy.blocks[0].inlines?.find((i) => i.type === "link");
      expect(noPolicyLink?.safe).toBe(false);
      expect(noPolicyLink?.destination).toBe(null);
    });
  });
}
