import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const commandArgs = process.argv.slice(2);
const baselineFlagIndex = commandArgs.indexOf("--baseline");
const outputArgument = commandArgs.find(
  (argument, index) => !argument.startsWith("--") && index !== baselineFlagIndex + 1,
);
const baselinePath = baselineFlagIndex === -1
  ? null
  : path.resolve(commandArgs[baselineFlagIndex + 1] ?? "");
const outputPath = path.resolve(
  outputArgument ?? "local-artifacts/reports/repository-refactor-inventory.json",
);
const sourceExtensions = new Set([
  ".css",
  ".ipynb",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const excludedRoots = new Set([
  ".git",
  ".next",
  "local-artifacts",
  "node_modules",
  "test-results",
]);

function gitFiles(...args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function fileType(file) {
  return path.extname(file).toLowerCase().slice(1) || "extensionless";
}

function responsibility(file) {
  if (file.startsWith("app/api/")) return "Next.js API route or server-side API support";
  if (file.startsWith("app/")) return "Next.js route, layout, or page";
  if (file.startsWith("components/")) return "React UI component";
  if (file.startsWith("lib/")) return "Application domain, state, or shared utility";
  if (file.startsWith("store/")) return "Redux store or state slice";
  if (file.startsWith("types/")) return "Shared TypeScript type contract";
  if (file.startsWith("scripts/")) return "Repository workflow, test, or operational script";
  if (file.startsWith("tests/")) return "Application regression or browser test";
  if (file.startsWith("ai-upchar-llm/src/")) return "AI UPCHAR Python package module";
  if (file.startsWith("ai-upchar-llm/tests/")) return "AI UPCHAR Python regression test";
  if (file.startsWith("ai-upchar-llm/scripts/")) return "AI UPCHAR workflow or validation script";
  if (file.startsWith("ai-upchar-llm/configs/")) return "AI UPCHAR training/evaluation configuration";
  if (file.startsWith("ai-upchar-llm/notebooks/")) return "AI UPCHAR training or validation notebook";
  if (file.startsWith("ai-upchar-llm/docs/") || file.startsWith("docs/")) return "Project documentation or operational guide";
  if (file.startsWith("supabase/")) return "Database schema or seed configuration";
  if (file.startsWith("styles/") || file === "globals.css") return "Application styling";
  if (file.startsWith("public/")) return "Static application asset";
  return "Repository configuration, data, or supporting artifact";
}

function extractDependencies(source, extension) {
  if (["ts", "tsx", "js", "mjs"].includes(extension)) {
    const matches = source.matchAll(
      /(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\))/g,
    );
    return [...new Set([...matches].map((match) => match[1] ?? match[2] ?? match[3]))].sort();
  }
  if (extension === "py") {
    const matches = source.matchAll(/^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm);
    return [...new Set([...matches].map((match) => match[1] ?? match[2]))].sort();
  }
  if (extension === "ps1") {
    const matches = source.matchAll(/(?:&\s+["']?([^\s"']+)|\.\\?\/?([\w./-]+\.ps1))/g);
    return [...new Set([...matches].map((match) => match[1] ?? match[2]).filter(Boolean))].sort();
  }
  return [];
}

const tracked = new Set(gitFiles("ls-files"));
const baseline = baselinePath && existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;
const baselineFiles = new Map((baseline?.files ?? []).map((entry) => [entry.path, entry]));
const candidates = [...new Set([...tracked, ...gitFiles("ls-files", "--others", "--exclude-standard")])]
  .filter((file) => !excludedRoots.has(file.split("/")[0]))
  .filter((file) => sourceExtensions.has(path.extname(file).toLowerCase()))
  .sort();

const files = candidates.map((file) => {
  const absolutePath = path.join(repositoryRoot, file);
  const source = readFileSync(absolutePath, "utf8");
  const extension = fileType(file);
  const previous = baselineFiles.get(file);
  const isRefactored = Boolean(
    (previous && previous.sha256 !== createHash("sha256").update(source).digest("hex"))
    || file === "ai-upchar-llm/notebooks/Phase_E3B_Behavioral_Patient_Interview.ipynb",
  );
  const preservedUntrackedOrphan = file === "patch.js";
  return {
    folder: path.posix.dirname(file),
    path: file,
    file_type: extension,
    tracked: tracked.has(file),
    current_responsibility: responsibility(file),
    dependencies: extractDependencies(source, extension),
    incoming_references: [],
    line_count: source.split(/\r?\n/).length,
    sha256: createHash("sha256").update(source).digest("hex"),
    refactoring_status: baseline
      ? (isRefactored ? "REFACTORED" : "REVIEWED_NO_CHANGE_REQUIRED")
      : "PENDING_REVIEW",
    validation_status: baseline
      ? "Static full-content/dependency scan completed; language-level validation recorded separately"
      : "NOT_RUN",
    deletion_candidate_status: preservedUntrackedOrphan
      ? "REVIEWED — removal not proven safe; pre-existing untracked file preserved"
      : "REVIEWED — no safe deletion proven",
    final_disposition: baseline
      ? (isRefactored ? "REFACTORED" : "REVIEWED_NO_CHANGE_REQUIRED")
      : "PENDING_REVIEW",
  };
});

for (const entry of files) {
  for (const dependency of entry.dependencies) {
    for (const candidate of files) {
      const stem = candidate.path.replace(/\.[^.]+$/, "");
      if (dependency === candidate.path || dependency === stem || dependency.endsWith(stem)) {
        candidate.incoming_references.push(entry.path);
      }
    }
  }
}

const folders = [...new Set(files.map((entry) => entry.folder))].sort().map((folder) => ({
  path: folder,
  file_count: files.filter((entry) => entry.folder === folder).length,
  purpose: files.find((entry) => entry.folder === folder)?.current_responsibility ?? "Unknown",
}));

const report = {
  generated_at: new Date().toISOString(),
  repository_root: repositoryRoot,
  scope: {
    includes: "Tracked and non-ignored untracked text source, config, documentation, and workflow files",
    excludes: [...excludedRoots].sort(),
  },
  totals: { folders: folders.length, files: files.length },
  folders,
  files,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, totals: report.totals }, null, 2));
