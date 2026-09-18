"use client";

export type ServerAiContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
export type ServerAiMessage = { role: "system" | "user" | "assistant"; content: ServerAiContent };
// `model` is accepted for call-site compatibility, but the server allowlists
// the configured model so the browser cannot choose an arbitrary model.
type Options = { model?: string; temperature?: number; maxTokens?: number };

export class ServerAiUnavailableError extends Error {
  constructor(message = "Server-side OpenAI AI is unavailable.") {
    super(message);
    this.name = "ServerAiUnavailableError";
  }
}

export async function serverAiChat(messages: ServerAiMessage[], options: Options = {}): Promise<string> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature: options.temperature, maxTokens: options.maxTokens }),
  });
  const data = await response.json().catch(() => null) as { content?: string; error?: string } | null;
  if (!response.ok || !data?.content) throw new ServerAiUnavailableError(data?.error);
  return data.content.trim();
}

export async function serverAiChatStream(
  messages: ServerAiMessage[],
  onToken: (full: string) => void,
  options: Options = {},
): Promise<string> {
  const full = await serverAiChat(messages, options);
  onToken(full);
  return full;
}

export async function serverAiAnalyzeImage(file: File, prompt: string): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
  return serverAiChat([
    { role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: dataUrl } },
    ] },
  ], { maxTokens: 900 });
}
