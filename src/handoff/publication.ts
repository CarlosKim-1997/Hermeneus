import {
  draftHandoffSchema,
  publishedHandoffSchema,
  toPublishedCanonicalItems,
  type DraftHandoff,
  type PublishedHandoff,
} from "./schema.js";

export class PublicationLedger {
  private readonly versions = new Map<string, PublishedHandoff[]>();

  publish(draft: DraftHandoff, publishedAt: string): PublishedHandoff {
    const parsed = draftHandoffSchema.parse(draft);
    const prior = this.versions.get(parsed.id) ?? [];
    const snapshot = publishedHandoffSchema.parse({
      handoffId: parsed.id,
      version: prior.length + 1,
      publishedAt,
      items: structuredClone(toPublishedCanonicalItems(parsed.items)),
    });
    const frozen = deepFreeze(snapshot);
    this.versions.set(parsed.id, [...prior, frozen]);
    return frozen;
  }

  get(handoffId: string, version: number): PublishedHandoff | undefined {
    return this.versions.get(handoffId)?.find((entry) => entry.version === version);
  }

  list(handoffId: string): readonly PublishedHandoff[] {
    return this.versions.get(handoffId) ?? [];
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as object)) deepFreeze(nested);
  }
  return value;
}
