import type { InterpretationAuthorityItem } from "../../src/receiver/interpretation-authority.js";
import type { Answerability } from "../../src/receiver/interpret.js";

export type AnswerEvalCase = {
  id: string;
  question: string;
  items: InterpretationAuthorityItem[];
  forceClassification: Answerability;
  forceCitations: string[];
  deterministicAnswer: string;
  expectGenerated: boolean;
  forbiddenPatterns?: RegExp[];
  requiredPatterns?: RegExp[];
};

export const answerEvalCases: AnswerEvalCase[] = [
  {
    id: "A1",
    question: "Where are we launching first?",
    items: [{ id: "web-mvp", type: "CONFIRMED", statement: "The MVP will launch as a browser-based product first.", priority: "CORE" }],
    forceClassification: "SUPPORTED",
    forceCitations: ["web-mvp"],
    deterministicAnswer: "The MVP will launch as a browser-based product first.",
    expectGenerated: true,
    requiredPatterns: [/browser|web/i],
    forbiddenPatterns: [/React|Next\.js|PWA/i],
  },
  {
    id: "A5",
    question: "What will the monthly subscription cost?",
    items: [{ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed.", priority: "CORE" }],
    forceClassification: "UNKNOWN",
    forceCitations: [],
    deterministicAnswer: "UNKNOWN. The approved handoff does not contain enough information to answer.",
    expectGenerated: false,
  },
  {
    id: "A6",
    question: "Are we using Google login?",
    items: [{ id: "auth", type: "OPEN", statement: "Authentication provider is unresolved.", priority: "CORE" }],
    forceClassification: "OPEN",
    forceCitations: ["auth"],
    deterministicAnswer: "The creator has not decided this. Authentication provider is unresolved.",
    expectGenerated: false,
  },
  {
    id: "A7",
    question: "Will the Receiver browse the web?",
    items: [{ id: "search-off", type: "CONSTRAINT", statement: "Web search is disabled for the Receiver agent.", priority: "CORE" }],
    forceClassification: "DERIVED",
    forceCitations: ["search-off"],
    deterministicAnswer: "No. Web search is disabled for the Receiver agent.",
    expectGenerated: false,
  },
];
