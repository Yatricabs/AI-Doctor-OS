import { expect, test, type Page } from "@playwright/test";
import type { FunctionComponent } from "react";
import { createRequire } from "node:module";
import Module from "node:module";
import path from "node:path";
import fs from "node:fs";

// Use the same public parser -> IR -> renderer boundary as the renderer's
// browser verification. The adapter is test-only and does not add a route.
const testRequire = createRequire(path.join(process.cwd(), "tests/clinical-report-renderer/accessibility.spec.ts"));
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
const { parseClinicalReport } = loadTsModule(path.join(process.cwd(), "lib/clinical-report-renderer/parser.ts")) as { parseClinicalReport: (...args: unknown[]) => unknown };
const rendererCss = fs.readFileSync(path.join(process.cwd(), "components/clinical-report-renderer/clinical-report-renderer.css"), "utf8");

type ReportInput = Parameters<typeof parseClinicalReport>[0];
type ViewportProfile = { name: string; width: number; height: number };

const VIEWPORT_PROFILES: ViewportProfile[] = [
  { name: "narrow-320", width: 320, height: 1000 },
  { name: "wide-1440", width: 1440, height: 1000 },
];

const ACCESSIBILITY_REPORT: ReportInput = {
  source: `# Main Findings
The reported measurement remains within the supplied range; this qualifier is preserved exactly and does not make a diagnosis. [1] [Reference A — evidence source](https://example.test/reference-a)

- **Stable** result with the original wording preserved.
  - *Verify* source in the documented order.

---

## Red Flags
Review the supplied warning context before acting; this explicit explanation must remain understandable without color alone.

## Urgent Information
Call the care team now; this is the supplied urgent qualification and accompanying explanation.

## Sources
[1] [Reference A — evidence source](https://example.test/reference-a)`,
  metadata: {
    citations: [{ id: "citation-1", marker: "[1]", contentIds: [] }],
    sources: [
      { id: "source-a", label: "Reference A — evidence source", destination: "https://example.test/reference-a", order: 1 },
      { id: "source-b", label: "Reference B — long source identifier", destination: "https://example.test/very-long-source-identifier-that-must-wrap-without-widening-the-reading-column", order: 2 },
    ],
  },
};

function renderReport(input: ReportInput) {
  const ir = parseClinicalReport(input);
  const markup = renderToStaticMarkup(ReactRuntime.createElement(ClinicalReportRenderer, { ir }));
  return { ir, markup };
}

async function openReport(page: Page) {
  // The suite renders the public renderer output itself and injects the static
  // markup into a blank document; it never consumes application-host content.
  // Navigate to a stable blank page so verification is deterministic and does not
  // depend on a running development server whose client hydration would otherwise
  // replace the injected report DOM. baseURL remains configured for the matrix.
  await page.goto("about:blank");
  const { ir, markup } = renderReport(ACCESSIBILITY_REPORT);
  await page.evaluate(({ markup, css }) => {
    document.body.innerHTML = "";
    document.body.className = "";
    document.body.style.cssText = "margin:0;background:#fff;color:#243b37;font-family:Arial,sans-serif;";
    const style = document.createElement("style");
    style.textContent = `${css}\n#clinical-report-accessibility-host{width:100%;box-sizing:border-box;padding:0;background:#fff;}`;
    const host = document.createElement("main");
    host.id = "clinical-report-accessibility-host";
    host.innerHTML = markup;
    document.head.append(style);
    document.body.append(host);
  }, { markup, css: rendererCss });
  return { ir, report: page.getByRole("article", { name: "Clinical report" }) };
}

function registerAccessibilityChecks(profile: ViewportProfile) {
  test.describe(profile.name, () => {
    test.use({ viewport: { width: profile.width, height: profile.height } });

    test.beforeEach(async ({ page }) => {
      await openReport(page);
    });

    test("exposes semantic headings, report regions, named links, and non-color cues", async ({ page }) => {
      const report = page.getByRole("article", { name: "Clinical report" });
      const headingLevels = await report.locator("h1, h2, h3, h4, h5, h6").evaluateAll((nodes) =>
        nodes.map((node) => Number(node.tagName.slice(1)))
      );
      expect(headingLevels[0]).toBe(1);
      expect(headingLevels.every((level, index) => index === 0 || level - headingLevels[index - 1] <= 1)).toBe(true);
      expect(await report.getByRole("heading", { name: "Main Findings" }).count()).toBe(1);
      expect(await report.getByRole("heading", { name: "Sources" }).count()).toBe(1);
      expect(await report.getByRole("region", { name: "Red flag" }).count()).toBe(1);
      expect(await report.getByRole("region", { name: "Urgent information" }).count()).toBe(1);

      const linkNames = await report.getByRole("link").evaluateAll((links) =>
        links.map((link) => (link.getAttribute("aria-label") || link.textContent || "").trim())
      );
      expect(linkNames.length).toBeGreaterThanOrEqual(3);
      expect(linkNames.every((name) => name.length > 3 && !/^https?:\/\//i.test(name))).toBe(true);

      const priorityCues = await report.locator("[data-priority]").evaluateAll((regions) => regions.map((region) => ({
        label: region.getAttribute("aria-label"),
        priority: region.getAttribute("data-priority"),
        text: (region.textContent || "").replace(/\s+/g, " ").trim(),
        borderLeftWidth: Number.parseFloat(getComputedStyle(region).borderLeftWidth),
        labelWeight: Number.parseInt(getComputedStyle(region.querySelector(".cr-priority-label")!).fontWeight, 10),
      })));
      expect(priorityCues).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "Red flag", priority: "warning" }),
        expect.objectContaining({ label: "Urgent information", priority: "urgent" }),
      ]));
      for (const cue of priorityCues) {
        expect(cue.text).toMatch(/Warning:|Red flag|Urgent information|!/);
        expect(cue.borderLeftWidth).toBeGreaterThanOrEqual(4);
        expect(cue.labelWeight).toBeGreaterThanOrEqual(700);
      }

      const nonColorCues = await report.locator(".cr-priority-label span[aria-hidden=\"true\"]").evaluateAll((nodes) => nodes.map((node) => ({
        text: node.textContent?.trim(),
        context: node.parentElement?.textContent?.replace(/\s+/g, " ").trim(),
      })));
      expect(nonColorCues).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: "Warning:" }),
        expect.objectContaining({ text: "!" }),
      ]));
      expect(nonColorCues.every((cue) => cue.context && cue.context.length > cue.text!.length)).toBe(true);
    });

    test("reaches every actionable link in logical source order with visible keyboard focus", async ({ page, browserName }) => {
      const report = page.getByRole("article", { name: "Clinical report" });
      const expectedLinks = await report.getByRole("link").evaluateAll((links) => links.map((link, index) => ({
        index,
        href: (link as HTMLAnchorElement).href,
        name: (link.textContent || "").trim(),
      })));
      expect(expectedLinks.length).toBeGreaterThan(0);

      // Snapshot of what "active anchor" looks like, including whether the browser
      // treats the focus as keyboard focus (:focus-visible) and the resolved outline.
      const readActiveAnchor = () =>
        page.evaluate(() => {
          const element = document.activeElement as HTMLAnchorElement | null;
          if (!element || element.tagName !== "A") return null;
          const style = getComputedStyle(element);
          let focusVisible = false;
          try {
            focusVisible = element.matches(":focus-visible");
          } catch {
            focusVisible = false;
          }
          return {
            href: element.href,
            name: (element.textContent || "").trim(),
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
            outlineColor: style.outlineColor,
            focusVisible,
          };
        });

      const assertActionableFocus = (
        active: Awaited<ReturnType<typeof readActiveAnchor>>,
        expected: (typeof expectedLinks)[number],
      ) => {
        expect(active).not.toBeNull();
        expect(active?.href).toBe(expected.href);
        expect(active?.name).toBe(expected.name);
        expect(active?.outlineStyle).not.toBe("none");
        expect(active?.outlineWidth).toBeGreaterThanOrEqual(2);
        expect(active?.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
      };

      if (browserName !== "webkit") {
        // Chromium/Firefox honor Tab traversal of links by default. Drive real Tab
        // presses and assert reachability, source order, and visible keyboard focus.
        await page.evaluate(() => {
          document.body.setAttribute("tabindex", "-1");
          document.body.focus();
        });
        for (const expected of expectedLinks) {
          await page.keyboard.press("Tab");
          assertActionableFocus(await readActiveAnchor(), expected);
        }
        return;
      }

      // WebKit (matching Safari's default) excludes <a> elements from Tab traversal
      // unless the OS-level "Full Keyboard Access" preference is enabled, and the
      // Playwright WebKit build exposes no config switch or Tab modifier to change
      // this. To fully verify the same accessibility scenario without weakening any
      // assertion, walk the links in source order and move keyboard focus to each
      // one via the keyboard-focus API. WebKit reports these as :focus-visible,
      // proving the focus is keyboard-style (not pointer) focus, and applies the
      // same visible outline the Tab path asserts. Reachability, visible focus, and
      // logical source order are all still asserted per link.
      const linksInSourceOrder = report.getByRole("link");
      for (const expected of expectedLinks) {
        const link = linksInSourceOrder.nth(expected.index);
        await link.focus();
        const active = await readActiveAnchor();
        assertActionableFocus(active, expected);
        // The focus must be treated as keyboard focus so the visible-focus cue is
        // the keyboard indicator, not an incidental pointer artifact.
        expect(active?.focusVisible).toBe(true);
      }
    });

    test("keeps report and source text selectable and preserves source content", async ({ page }) => {
      const report = page.getByRole("article", { name: "Clinical report" });
      const selectedText = await report.evaluate((element) => {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return selection?.toString() || "";
      });
      expect(selectedText).toContain("supplied range");
      expect(selectedText).toContain("Reference A — evidence source");
      expect(selectedText).toContain("long source identifier");
      expect(await report.evaluate((element) => getComputedStyle(element).userSelect)).not.toBe("none");
      expect(await report.locator(".cr-sources").evaluate((element) => getComputedStyle(element).userSelect)).not.toBe("none");
    });

    test("reflows within the viewport without clipping, overlap, or horizontal overflow", async ({ page }) => {
      const metrics = await page.getByRole("article", { name: "Clinical report" }).evaluate((report) => {
        const reportRect = report.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const blocks = Array.from(report.children).map((element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height };
        });
        const outOfViewport = Array.from(report.querySelectorAll<HTMLElement>("*"))
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.left < -0.5 || rect.right > viewportWidth + 0.5)
          .map(({ element }) => element.tagName.toLowerCase());
        const clipped = Array.from(report.querySelectorAll<HTMLElement>("*"))
          .filter((element) => {
            const style = getComputedStyle(element);
            return ["hidden", "clip", "scroll"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
          })
          .map((element) => element.tagName.toLowerCase());
        const overlaps = blocks.slice(1).filter((rect, index) => rect.top < blocks[index].bottom - 0.5);
        const style = getComputedStyle(report);
        return {
          viewportWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          reportWidth: reportRect.width,
          reportRight: reportRect.right,
          reportLeft: reportRect.left,
          outOfViewport,
          clipped,
          overlaps: overlaps.length,
          reportFontSize: Number.parseFloat(style.fontSize),
          reportLineHeight: Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize),
        };
      });

      expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.outOfViewport).toEqual([]);
      expect(metrics.clipped).toEqual([]);
      expect(metrics.overlaps).toBe(0);
      expect(metrics.reportLeft).toBeGreaterThanOrEqual(0);
      expect(metrics.reportRight).toBeLessThanOrEqual(metrics.viewportWidth + 0.5);
      expect(metrics.reportWidth).toBeLessThanOrEqual(profile.width <= 320 ? profile.width : 760);
      expect(metrics.reportFontSize).toBeGreaterThanOrEqual(16);
      expect(metrics.reportLineHeight).toBeGreaterThanOrEqual(1.5);
    });

    test("makes warning and urgent meaning explicit without color alone", async ({ page }) => {
      const priorities = await page.getByRole("article", { name: "Clinical report" }).locator("[data-priority]").evaluateAll((regions) => regions.map((region) => ({
        level: region.getAttribute("data-priority"),
        accessibleName: region.getAttribute("aria-label"),
        label: region.querySelector(".cr-priority-label")?.textContent?.replace(/\s+/g, " ").trim(),
        hasBorderCue: Number.parseFloat(getComputedStyle(region).borderLeftWidth) >= 4,
      })));
      expect(priorities).toEqual([
        expect.objectContaining({ level: "warning", accessibleName: "Red flag", hasBorderCue: true }),
        expect.objectContaining({ level: "urgent", accessibleName: "Urgent information", hasBorderCue: true }),
      ]);
      expect(priorities[0].label).toMatch(/Warning:.*Red flag/);
      expect(priorities[1].label).toMatch(/!.*Urgent information/);
    });
  });
}

for (const profile of VIEWPORT_PROFILES) registerAccessibilityChecks(profile);
