// Minimal ambient typings for the Puter.js browser SDK (https://js.puter.com/v2/).
export {};

declare global {
  interface PuterChatMessageContentPart {
    type: "text" | "file" | "image_url";
    text?: string;
    puter_path?: string;
    image_url?: { url: string };
  }

  interface PuterChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | PuterChatMessageContentPart[];
  }

  interface PuterChatOptions {
    model?: string;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
  }

  interface PuterChatResponse {
    message?: { role: string; content?: string | null };
    text?: string;
    toString(): string;
  }

  interface PuterChatChunk {
    type?: string;
    text?: string;
    message?: { content?: string };
  }

  interface PuterFS {
    write(path: string, data: File | Blob | string): Promise<{ path: string }>;
    delete(path: string): Promise<void>;
  }

  interface PuterAI {
    chat(
      prompt: string | PuterChatMessage[],
      options?: PuterChatOptions
    ): Promise<PuterChatResponse | AsyncIterable<PuterChatChunk>>;
    chat(
      prompt: string,
      media: string | File,
      testMode?: boolean,
      options?: PuterChatOptions
    ): Promise<PuterChatResponse>;
  }

  interface Puter {
    ai: PuterAI;
    fs: PuterFS;
  }

  interface Window {
    puter?: Puter;
  }
}
