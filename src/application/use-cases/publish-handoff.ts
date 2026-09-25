import type { PublishedHandoff } from "../../handoff/schema.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function publishHandoff(repos: Repos, handoffId: string): Promise<PublishedHandoff> {
  return repos.published.publish(handoffId, new Date().toISOString());
}

export async function loadPublishedHandoff(
  repos: Repos,
  handoffId: string,
  version: number,
): Promise<PublishedHandoff | undefined> {
  return repos.published.get(handoffId, version);
}
