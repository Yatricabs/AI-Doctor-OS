"use client";

// Renders AI (Puter.js) plain-text output as a clean, structured clinical panel.
// The models return markdown-ish text — short heading lines, "•"/"-"/"*" bullet
// lists, and paragraphs. This turns that into readable HTML instead of a raw
// monospace <pre> block, while streaming (it re-parses on every update).
import { Sparkles } from "lucide-react";

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; text: string };

// Strip leading markdown bullet/number markers from a line.
function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim();
}

function isBullet(line: string): boolean {
  return /^\s*(?:[-*•·]|\d+[.)])\s+/.test(line);
}

// A heading is a short, non-bullet line that ends with ":" or is wrapped in **bold**.
function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || isBullet(t)) return false;
  if (/^\*\*.+\*\*:?$/.test(t)) return true;
  if (/^#{1,6}\s+/.test(t)) return true;
  return t.length <= 60 && t.endsWith(":");
}

// Remove inline markdown emphasis markers (**bold**, *italic*, `code`).
function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .replace(/:$/, "")
    .trim();
}

function parse(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentList: string[] | null = null;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length) {
      blocks.push({ kind: "para", text: paraBuf.join(" ").trim() });
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (currentList && currentList.length) blocks.push({ kind: "list", items: currentList });
    currentList = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (isBullet(line)) {
      flushPara();
      (currentList ??= []).push(cleanInline(stripBullet(line)));
      continue;
    }
    if (isHeading(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", text: cleanInline(line) });
      continue;
    }
    flushList();
    paraBuf.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

export default function AIResponse({
  text,
  streaming = false,
  tone = "clinical",
}: {
  text: string;
  streaming?: boolean;
  tone?: "clinical" | "copilot";
}) {
  if (!text.trim()) return null;
  const blocks = parse(text);

  const accent = tone === "copilot" ? "text-[#5a6bb0]" : "text-[#2f8f74]";
  const dot = tone === "copilot" ? "bg-[#8091d8]" : "bg-[#4fb493]";

  return (
    <div className="mt-4 rounded-xl border border-[#dfeee7] bg-white">
      <div className="flex items-center gap-2 border-b border-[#eef4f1] px-4 py-2.5">
        <Sparkles className={`h-3.5 w-3.5 ${accent}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wide ${accent}`}>
          AI response
        </span>
        <span className="ml-auto rounded-full bg-[#f0f6f3] px-2 py-0.5 text-[10px] font-semibold text-[#7f9b90]">
          Review required
        </span>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm leading-6 text-[#3f524c]">
        {blocks.map((b, i) => {
          if (b.kind === "heading") {
            return (
              <p key={i} className={`text-[13px] font-bold ${accent}`}>
                {b.text}
              </p>
            );
          }
          if (b.kind === "list") {
            return (
              <ul key={i} className="space-y-1.5">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i}>{b.text}</p>
          );
        })}
        {streaming && (
          <span className="inline-block h-4 w-[2px] animate-pulse bg-[#9db3aa] align-middle" />
        )}
      </div>

      <p className="border-t border-[#eef4f1] px-4 py-2 text-[10px] leading-4 text-[#9aaba3]">
        AI-generated · not a diagnosis · the clinician makes the final decision.
      </p>
    </div>
  );
}
