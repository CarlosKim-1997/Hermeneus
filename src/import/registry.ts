import { genericTextAdapter } from "./generic-text-adapter.js";
import type { ConversationAdapter, ImportInput, NormalizedConversation } from "./types.js";

/**
 * Implemented adapters only. chatgpt, claude, gemini, and generic-json are
 * future registration points and intentionally have no parser here.
 */
const adapters: ConversationAdapter[] = [genericTextAdapter];

export async function importConversation(input: ImportInput): Promise<NormalizedConversation> {
  for (const adapter of adapters) {
    if (await adapter.canHandle(input)) return adapter.parse(input);
  }
  throw new Error("No conversation adapter can handle this input");
}

export function registeredAdapterIds(): string[] {
  return adapters.map((adapter) => adapter.id);
}
