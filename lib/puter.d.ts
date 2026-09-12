// Minimal ambient typings for the Puter.js browser SDK (https://js.puter.com/v2/).
// Only the surface AI UPCHAR uses is typed; the SDK exposes much more.
export {};

declare global {
  /** One message in a chat conversation. */
  interface PuterChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }

  /** Options accepted by puter.ai.chat(). */
  interface PuterChatOptions {
    model?: string;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
  }

  /** Non-streaming response shape (OpenAI-normalized). */
  interface PuterChatResponse {
    message?: { role: string; content?: string | null };
    // Some models/vendors return the text at the top level or via toString().
    text?: string;
    toString(): string;
  }

  /** A single streamed chunk. */
  interface PuterChatChunk {
    type?: string;
    text?: string;
    message?: { content?: string };
  }

  interface PuterAI {
    chat(
      prompt: string | PuterChatMessage[],
      options?: PuterChatOptions
    ): Promise<PuterChatResponse | AsyncIterable<PuterChatChunk>>;
  }

  interface PuterAuth {
    isSignedIn(): boolean;
    signIn(): Promise<unknown>;
    getUser(): Promise<{ username?: string } | null>;
  }

  interface Puter {
    ai: PuterAI;
    auth?: PuterAuth;
  }

  interface Window {
    puter?: Puter;
  }
}
