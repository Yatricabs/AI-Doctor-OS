import { test, expect, type Page } from "@playwright/test";
import type { FunctionComponent } from "react";
import { createRequire } from "node:module";
import Module from "node:module";
import path from "node:path";
import fs from "node:fs";

// The browser suite consumes the same public parser -> IR -> renderer boundary as
// the semantic tests. The static render is only a test adapter; the application
// host remains the manually started Playwright baseURL.
const testRequire = createRequire(path.join(process.cwd(), "tests/clinical-report-renderer/browser-verification.spec.ts"));
testRequire.extensions[".css"] = () => undefined;
const ReactRuntime = testRequire("react") as typeof import("react");
(globalThis as Record<string, unknown>).React = ReactRuntime;
const { renderToStaticMarkup } = testRequire("react-dom/server") as typeof import("react-dom/server");
const { transform } = testRequire("sucrase") as typeof import("sucrase");

// Load the renderer/parser TSX+TS with the classic JSX runtime so JSX compiles to
// the real React.createElement. The Playwright runner otherwise transpiles required
// TS with the automatic runtime and its own jsx-runtime, which yields host-specific
// element objects that react-dom/server cannot render. This is test-only module
// loading support; it does not alter the public renderer boundary or its behavior.
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

const { default: ClinicalReportRenderer } = loadTsModule(path.join(process.cwd(), "components/clinical-report-renderer/ClinicalReportRenderer.tsx")) as { default: FunctionComponent<{ ir: unknown; className?: string }> };
const { parseClinicalReport } = loadTsModule(path.join(process.cwd(), "lib/clinical-report-renderer/parser.ts")) as { parseClinicalReport: (...args: unknown[]) => { state: string } };
const rendererCss = fs.readFileSync(path.join(process.cwd(), "components/clinical-report-renderer/clinical-report-renderer.css"), "utf8");

const APP_ORIGIN = "http://127.0.0.1:3000";
const profiles = [
  { name: "narrow 320 CSS px", viewport: { width: 320, height: 1000 } },
  { name: "wide 1440 CSS px", viewport: { width: 1440, height: 1000 } },
] as const;

type ReportInput = Parameters<typeof parseClinicalReport>[0];

function renderReport(input: ReportInput) {
  const ir = parseClinicalReport(input);
  const markup = renderToStaticMarkup(ReactRuntime.createElement(ClinicalReportRenderer, { ir }));
  return { ir, markup };
}

async function openReport(page: Page, input: ReportInput) {
  // The suite renders the public renderer output itself and injects the static
  // markup into a blank document; it never consumes application-host content.
  // Navigate to a stable blank page so verification is deterministic and does not
  // depend on a running development server whose client hydration would otherwise
  // replace the injected report DOM. baseURL remains configured for the matrix.
  await page.goto("about:blank");
  const { ir, markup } = renderReport(input);
  await page.evaluate(({ markup, css }) => {
    document.body.innerHTML = "";
    document.body.className = "";
    document.body.style.cssText = "margin:0;background:#fff;color:#243b37;font-family:Arial,sans-serif;";
    const style = document.createElement("style");
    style.textContent = `${css}\n#clinical-report-browser-host{width:100%;box-sizing:border-box;padding:0;background:#fff;}`;
    const host = document.createElement("main");
    host.id = "clinical-report-browser-host";
    host.innerHTML = markup;
    document.head.append(style);
    document.body.append(host);
  }, { markup, css: rendererCss });
  return { ir, report: page.locator(".clinical-report").first() };
}

function longReportSource() {
  const longParagraph = `The supplied qualifier remains unchanged and should remain readable across the complete report. ${"Additional contextual detail is preserved without summarization. ".repeat(18)}LONG-END-SENTINEL.`;
  const longUrl = `https://example.test/evidence/${"very-long-segment-".repeat(18)}end`;
  const list = Array.from({ length: 12 }, (_, index) => `- List item ${index + 1} preserves its complete wording and ordering.`).join("\n");
  return `# Main Findings\n${longParagraph}\n\n${list}\n\n## Evidence\n[1] [Long source label ${"with context ".repeat(10)}](https://example.test/reference)\n\n${longUrl}`;
}

async function layoutSnapshot(page: Page) {
  return page.locator(".clinical-report").evaluate((report) => {
    const reportRect = report.getBoundingClientRect();
    const reportStyle = getComputedStyle(report);
    const elements = Array.from(report.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          display: style.display,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          overflowX: style.overflowX,
        };
      });
    const directBlocks = Array.from(report.children)
      .map((element) => element as HTMLElement)
      .filter((element) => element.getBoundingClientRect().height > 0);
    const gaps = directBlocks.slice(0, -1).map((element, index) => {
      const current = element.getBoundingClientRect();
      const next = directBlocks[index + 1].getBoundingClientRect();
      return { gap: next.top - current.bottom, from: element.className, to: directBlocks[index + 1].className };
    });
    return {
      viewportWidth: window.innerWidth,
      reportWidth: reportRect.width,
      reportLeft: reportRect.left,
      reportRight: reportRect.right,
      fontSize: Number.parseFloat(reportStyle.fontSize),
      lineHeight: Number.parseFloat(reportStyle.lineHeight),
      clientWidth: report.clientWidth,
      scrollWidth: report.scrollWidth,
      elements,
      gaps,
    };
  });
}

for (const profile of profiles) {
  test.describe(`Clinical report browser verification at ${profile.name}`, () => {
    test.use({ viewport: profile.viewport });

    test("renders supported constructs, hierarchy, wording, citations, and source order", async ({ page }) => {
      const source = `# Main Findings\nThe value is 12 mg/L (range 10–14 mg/L); it is not a diagnosis. [1]\n\n- **Stable** result\n  - *Verify* source\n\n1. First ordered item\n2. Second ordered item\n\n---\n\n## Clinical Considerations\nThe supplied consideration remains exactly as written.\n\n## Recommendations\n- Continue the documented follow-up plan; do not add an instruction.\n\n## Evidence\n[1] [Reference A](https://example.test/reference-a)`;
      const { report } = await openReport(page, {
        source,
        metadata: {
          citations: [{ id: "citation-1", marker: "[1]", contentIds: [], linkId: "link-1", linkedSourceId: "source-a" }],
          sources: [
            { id: "source-b", label: "Reference B", destination: "https://example.test/reference-b", order: 2 },
            { id: "source-a", label: "Reference A", destination: "https://example.test/reference-a", order: 1 },
          ],
        },
      });

      await expect(report).toContainText("The value is 12 mg/L (range 10–14 mg/L); it is not a diagnosis.");
      await expect(report.locator("strong")).toHaveText("Stable");
      await expect(report.locator("em")).toHaveText("Verify");
      await expect(report.locator("hr")).toHaveCount(1);
      await expect(report.locator("ul").first().locator("> li").first()).toContainText("Stable result");
      await expect(report.locator("ul > li > ul > li")).toContainText("Verify source");
      await expect(report.locator("ol").first()).toContainText("First ordered item");
      await expect(report.locator(".cr-citation").first()).toHaveText("[1]");
      await expect(report.locator("a").filter({ hasText: "Reference A" }).first()).toHaveAttribute("href", "https://example.test/reference-a");
      await expect(report.locator(".cr-sources h2")).toHaveText("Evidence");
      await expect(report.locator(".cr-sources li").nth(0)).toHaveText("Reference A");
      await expect(report.locator(".cr-sources li").nth(1)).toHaveText("Reference B");
      await expect(report.locator("h1")).toHaveText("Main Findings");
      await expect(report.locator("h2")).toHaveText(["Clinical Considerations", "Recommendations", "Evidence"]);
      expect(await report.textContent()).not.toContain("**");
    });

    test("shows explicit sections and distinct priorities without keyword inference", async ({ page }) => {
      const explicit = await openReport(page, {
        source: `# Main Findings\nNormal supplied text.\n\n## Important Information\nElevated supplied context.\n\n## Red Flags\nWarning supplied context with its explanation.\n\n## Urgent Information\nUrgent supplied context with its qualification.`,
      });
      await expect(explicit.report.locator("h1")).toHaveAttribute("data-section", "findings");
      await expect(explicit.report.locator("h2").nth(0)).toHaveAttribute("data-section", "important");
      await expect(explicit.report.locator("h2").nth(1)).toHaveAttribute("data-section", "red-flags");
      await expect(explicit.report.locator("h2").nth(2)).toHaveAttribute("data-section", "urgent");
      // Explicit sections drive distinct priority presentation on the section heading
      // itself; the supplied content stays visible and faithful beneath each heading.
      await expect(explicit.report.locator("h2.cr-priority-text-important")).toHaveText("Important Information");
      await expect(explicit.report.locator("h2.cr-priority-text-warning")).toHaveText("Red Flags");
      await expect(explicit.report.locator("h2.cr-priority-text-urgent")).toHaveText("Urgent Information");
      await expect(explicit.report).toContainText("Elevated supplied context.");
      await expect(explicit.report).toContainText("Warning supplied context with its explanation.");
      await expect(explicit.report).toContainText("Urgent supplied context with its qualification.");
      await expect(explicit.report.locator("h2.cr-priority-text-urgent")).toBeVisible();

      const ordinary = await openReport(page, {
        source: "The word emergency appears in ordinary prose, while warning is discussed as a label only. **urgent** and *red flag* are styling-only words.",
      });
      // Ordinary alarming keywords must not produce any priority classification.
      await expect(ordinary.report.locator("[data-priority]")).toHaveCount(0);
      await expect(ordinary.report.locator(".cr-priority-label")).toHaveCount(0);
      await expect(ordinary.report.locator('[class*="cr-priority-text-"]')).toHaveCount(0);
      await expect(ordinary.report.locator("strong")).toHaveText("urgent");
      await expect(ordinary.report.locator("em")).toHaveText("red flag");
      await expect(ordinary.report).toContainText("emergency appears in ordinary prose");
    });

    test("keeps malformed content readable and renders empty, error, fallback, and ready states", async ({ page }) => {
      const empty = await openReport(page, { source: "   " });
      await expect(empty.report).toHaveAttribute("aria-label", "Clinical report");
      await expect(empty.report.locator("h2")).toHaveText("No report available");
      await expect(empty.report).toContainText("No clinical report content was supplied.");
      await expect(empty.report.locator("p")).not.toContainText(/finding|recommendation|warning|urgent|emergency/i);

      const errorSource = "A source finding must remain diagnostic context only.";
      const error = await openReport(page, {
        source: errorSource,
        metadata: { unknown: { retained: true } },
        upstreamError: { code: "UPSTREAM_TIMEOUT", message: "Unable to load the upstream report." },
      });
      await expect(error.report).toHaveAttribute("aria-label", "Clinical report error");
      await expect(error.report.locator("h2")).toHaveText("Report unavailable");
      await expect(error.report).toContainText("Unable to load the upstream report.");
      await expect(error.report).toContainText("No clinical content was presented.");
      await expect(error.report).not.toContainText(errorSource);

      const malformedSource = "Broken **emphasis remains readable\n\n# Later heading\nThe value remains uncertain (range 2–4 mg/L).";
      const fallback = await openReport(page, { source: malformedSource });
      await expect(fallback.report.locator('[role="status"]')).toContainText("shown faithfully");
      // Malformed content is preserved verbatim as readable report text, not dropped.
      await expect(fallback.report.locator("p").filter({ hasText: "Broken **emphasis remains readable" })).toHaveCount(1);
      await expect(fallback.report.locator("h1")).toHaveText("Later heading");
      await expect(fallback.report).toContainText("range 2–4 mg/L");
      expect(fallback.ir.state).toBe("fallback");
    });

    test("enforces safe-link policy defaults and keeps report text non-executable", async ({ page }) => {
      const safe = await openReport(page, {
        source: "[Approved](/records/1) [External](https://example.test/reference) [Unsafe](javascript:alert(1)) [Outside](/outside/2)",
        safeLinkPolicy: { approvedRelativePathPrefixes: ["/records"] },
        safeLinkContext: { applicationOrigin: APP_ORIGIN, currentPath: "/reports/current" },
      });
      await expect(safe.report.locator("a").filter({ hasText: "Approved" })).toHaveAttribute("href", `${APP_ORIGIN}/records/1`);
      await expect(safe.report.locator("a").filter({ hasText: "External" })).toHaveAttribute("target", "_blank");
      await expect(safe.report.locator("a").filter({ hasText: "External" })).toHaveAttribute("rel", /noopener.*noreferrer/);
      await expect(safe.report.locator("a")).toHaveCount(2);
      await expect(safe.report.locator('[title="Link unavailable"]')).toHaveText(["Unsafe", "Outside"]);
      // Neither neutralized link is actionable: none carries an href destination.
      await expect(safe.report.locator('[title="Link unavailable"][href]')).toHaveCount(0);

      const noPolicy = await openReport(page, { source: "[No policy](/records/2) [No context](/records/3)" });
      await expect(noPolicy.report.locator("a")).toHaveCount(0);
      await expect(noPolicy.report.locator('[title="Link unavailable"]')).toHaveText(["No policy", "No context"]);

      const executableText = "<script>alert('xss')</script> & <img src=x onerror=alert(1)>";
      const safeText = await openReport(page, { source: executableText });
      await expect(safeText.report).toContainText(executableText);
      await expect(safeText.report.locator("script, img")).toHaveCount(0);
      await expect(safeText.report.locator("[onerror], [onclick], [onload]")).toHaveCount(0);
    });

    test("preserves long content and URLs without clipping, overlap, truncation, or spacing failures", async ({ page }) => {
      const longSource = longReportSource();
      const { report } = await openReport(page, {
        source: longSource,
        metadata: {
          sources: [
            { id: "source-a", label: `Long source label ${"with context ".repeat(10)}`, destination: "https://example.test/reference" },
            { id: "source-b", label: "Last source sentinel", destination: `https://example.test/${"long-path-".repeat(20)}end` },
          ],
        },
      });
      const snapshot = await layoutSnapshot(page);
      expect(snapshot.fontSize).toBeGreaterThanOrEqual(16);
      expect(snapshot.lineHeight / snapshot.fontSize).toBeGreaterThanOrEqual(1.5);
      expect(snapshot.reportWidth).toBeLessThanOrEqual(760);
      expect(snapshot.reportLeft).toBeGreaterThanOrEqual(-0.5);
      expect(snapshot.reportRight).toBeLessThanOrEqual(snapshot.viewportWidth + 0.5);
      expect(snapshot.scrollWidth).toBeLessThanOrEqual(snapshot.clientWidth + 1);
      expect(snapshot.gaps.every(({ gap }) => gap >= 8 - 0.5 && gap <= 48 + 0.5)).toBeTruthy();
      expect(snapshot.elements.every(({ display, left, right, scrollWidth, clientWidth, overflowX }) => {
        // Horizontal bounds and the no-clip overflow mode are enforced for every rendered
        // element regardless of display type. The scrollWidth<=clientWidth content-overflow
        // check is only meaningful for elements that establish a content box; inline
        // (non-replaced) elements have no client box and report clientWidth 0 with a nonzero
        // scrollWidth in Firefox/WebKit by spec, so the report-level scroll check below and
        // these per-element bounds guard their horizontal fit instead.
        const withinBounds = left >= snapshot.reportLeft - 1 && right <= snapshot.reportRight + 1 && overflowX !== "hidden";
        const noContentOverflow = display === "inline" || scrollWidth <= clientWidth + 1;
        return withinBounds && noContentOverflow;
      })).toBeTruthy();
      expect(snapshot.elements.every(({ top, bottom }) => bottom >= top)).toBeTruthy();
      await expect(report).toContainText("LONG-END-SENTINEL");
      await expect(report.locator(".cr-sources li").last()).toHaveText("Last source sentinel");
      await expect(report).toContainText("very-long-segment-");
    });
  });
}
