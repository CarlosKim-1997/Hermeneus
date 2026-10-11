import { buildReceiverPacket, matchesAuthorizedPacket, receiverSubmissionSchema } from "../../portable/receiver-packet.js";
import { aggregateVerdict, unavailableVerdict, type ExternalVerifierPort } from "../../receiver/external/verifier.js";
import type { getRepositories } from "../runtime.js";
import { loadPublishedViewForShareResolution } from "./shared-receiver-qa.js";

export async function verifyExternalAnswer(
  repos: ReturnType<typeof getRepositories>,
  token: string,
  rawSubmission: unknown,
  verifier?: ExternalVerifierPort,
) {
  const view = await loadPublishedViewForShareResolution(repos, token);
  if (!view) return { kind: "unavailable" as const };
  const packet = buildReceiverPacket(view);
  const parsed = receiverSubmissionSchema.safeParse(rawSubmission);
  if (!parsed.success || !matchesAuthorizedPacket(parsed.data, packet)) {
    return { kind: "invalid" as const };
  }
  let result;
  try {
    result = verifier ? aggregateVerdict(packet, parsed.data, await verifier.analyze({ packet, submission: parsed.data })) : unavailableVerdict(packet);
  } catch {
    result = unavailableVerdict(packet);
  }
  // In-flight revocation, account or Handoff deletion invalidates even a completed analysis.
  const after = await loadPublishedViewForShareResolution(repos, token);
  if (!after || buildReceiverPacket(after).canonicalDigest !== packet.canonicalDigest) {
    return { kind: "unavailable" as const };
  }
  return { kind: "verdict" as const, result };
}
