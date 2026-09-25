import type { NormalizedConversation } from "../import/types.js";
import { MAX_EXTRACTION_CANDIDATES } from "./constants.js";
import { ExtractionError } from "./errors.js";
import { extractionProposalSchema, type ExtractionProposal } from "./proposal-schema.js";

export function validateExtractionProposal(
  conversation: NormalizedConversation,
  proposal: ExtractionProposal,
): ExtractionProposal {
  const parsed = extractionProposalSchema.parse(proposal);

  if (parsed.candidates.length > MAX_EXTRACTION_CANDIDATES) {
    throw new ExtractionError(
      "MODEL_OUTPUT_INVALID",
      `Extraction returned ${parsed.candidates.length} candidates; maximum is ${MAX_EXTRACTION_CANDIDATES}.`,
    );
  }

  const messages = new Map(conversation.messages.map((message) => [message.id, message]));

  for (const candidate of parsed.candidates) {
    let hasCreatorSource = false;

    for (const reference of candidate.sources) {
      const message = messages.get(reference.messageId);
      if (!message) {
        throw new ExtractionError(
          "PROVENANCE_INVALID",
          `Source message ${reference.messageId} does not exist in the conversation.`,
        );
      }
      if (message.role === "creator") {
        hasCreatorSource = true;
      }
      if (!reference.excerpt || !message.content.includes(reference.excerpt)) {
        throw new ExtractionError(
          "PROVENANCE_INVALID",
          `Excerpt for message ${reference.messageId} is not an exact substring of the source message.`,
        );
      }
    }

    if (!hasCreatorSource) {
      throw new ExtractionError(
        "PROVENANCE_INVALID",
        "Each extraction candidate must cite at least one Creator-role source message.",
      );
    }
  }

  return parsed;
}
