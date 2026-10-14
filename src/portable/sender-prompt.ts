// Adapted from the reconciled package's Bootstrap_Prompt_v0_DRAFT.md.
// This is generation guidance, not Canon or a guarantee of semantic fidelity.
export const SENDER_BOOTSTRAP_PROMPT = `Prepare a Portable Canon Proposal for Hermeneus from the context actually available in this conversation.

Faithfully extract the human Sender's current approved meaning. Do not improve the project or advise what it should become. Treat assistant suggestions, quoted documents and exploratory alternatives as proposals unless the human explicitly adopted them. Prioritize later explicit Sender decisions. Mark an alternative REJECTED only when its rejection or supersession is supported.

Use only visible context. Do not claim access to messages you cannot inspect. Do not invent decisions, intent, rationale, original message IDs, quotations, timestamps, citations, private memories or provider metadata. When commitment is uncertain, do not use CONFIRMED or CONSTRAINT. Use TENTATIVE for supported provisional ideas and OPEN only for explicitly unresolved matters. Put possible omissions and uncertainty in reviewNotes for the Sender to check.

Return one strict JSON object only: no Markdown code fences, prose or comments. Use this shape:
{
  "protocol": "hermeneus.portable-proposal/v0",
  "items": [
    {"proposalId":"P-001","type":"CORE_INTENT","priority":"CORE","statement":"A supported statement of the Sender's purpose."}
  ],
  "reviewNotes": ["An uncertainty the Sender should review."]
}

Allowed type: CORE_INTENT, CONTEXT, CONFIRMED, TENTATIVE, OPEN, REJECTED, CONSTRAINT, RATIONALE.
Allowed priority: CORE, IMPORTANT, SUPPORTING.
Each item must contain exactly proposalId, type, priority and statement. Use unique IDs P-001, P-002, and so on. Do not add sources, createdBy, owner, confidence, version, approved or published fields. Do not repeat JSON keys.

The optional title is a nonblank display suggestion of at most 160 Unicode characters. Omit it if unsupported. It is not Canon: Hermeneus saves it only if the Creator explicitly chooses private navigation metadata, and never includes it in the published content or Receiver Packet.

reviewNotes is optional: at most 20 nonblank notes, each at most 1,000 Unicode characters. Notes are shown before Draft creation and are not saved. Important durable uncertainty must be manually added to the Draft by the Creator.

Use 1–50 items, each with a nonblank statement of at most 4,000 Unicode characters. The entire JSON must be at most 128 KiB in UTF-8. Character limits count Unicode code points; the total limit counts bytes. Keep one independently meaningful assertion per item, use concise language, and prefer fidelity over filling a quota. Preserve the Sender's language unless asked otherwise. Include sensitive details only if necessary to the intended meaning and supported by visible context.

If no supported item can be formed, ask the Sender to supply the missing context instead of fabricating an item or returning an empty proposal.

Before output, check JSON syntax, unique IDs, allowed enums and that no AI suggestion was promoted to a human decision. This output is an unverified proposal. Human review, correction and explicit publication in Hermeneus are required. Do not claim completeness or semantic verification.`;
