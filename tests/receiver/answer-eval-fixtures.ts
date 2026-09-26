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
    id: "A2",
    question: "What are we building and who is it for?",
    items: [
      { id: "a", type: "CONFIRMED", statement: "The product is a browser-based MVP.", priority: "CORE" },
      { id: "b", type: "CONFIRMED", statement: "The initial audience is internal creators.", priority: "CORE" },
    ],
    forceClassification: "SUPPORTED",
    forceCitations: ["a", "b"],
    deterministicAnswer: "The product is a browser-based MVP. The initial audience is internal creators.",
    expectGenerated: true,
    forbiddenPatterns: [/enterprise SaaS pricing/i],
  },
  {
    id: "A3",
    question: "Are we shipping iOS/Android first?",
    items: [{ id: "mobile-rejected", type: "REJECTED", statement: "Native mobile launch was rejected for the first release.", priority: "CORE" }],
    forceClassification: "SUPPORTED",
    forceCitations: ["mobile-rejected"],
    deterministicAnswer: "No. Native mobile launch was rejected for the first release.",
    expectGenerated: true,
    requiredPatterns: [/reject|not|No/i],
  },
  {
    id: "A4",
    question: "Has email login been finalized?",
    items: [{ id: "email-tentative", type: "TENTATIVE", statement: "Email login is tentatively preferred.", priority: "CORE" }],
    forceClassification: "SUPPORTED",
    forceCitations: ["email-tentative"],
    deterministicAnswer: "This is still tentative. Email login is tentatively preferred.",
    expectGenerated: true,
    requiredPatterns: [/tentative/i],
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
  {
    id: "A8",
    question: "Should we use React or Next.js?",
    items: [{ id: "web-mvp", type: "CONFIRMED", statement: "The MVP will launch as a browser-based product first.", priority: "CORE" }],
    forceClassification: "SUPPORTED",
    forceCitations: ["web-mvp"],
    deterministicAnswer: "The MVP will launch as a browser-based product first.",
    expectGenerated: true,
    forbiddenPatterns: [/React|Next\.js|PWA|Vue/i],
  },
  {
    id: "A9",
    question: "What is the v1 plan?",
    items: [{ id: "v1", type: "CONFIRMED", statement: "Version one keeps browser-first scope.", priority: "CORE" }],
    forceClassification: "SUPPORTED",
    forceCitations: ["v1"],
    deterministicAnswer: "Version one keeps browser-first scope.",
    expectGenerated: true,
  },
  {
    id: "A10",
    question: "When is launch?",
    items: [
      {
        id: "inj",
        type: "CONFIRMED",
        statement: "Launch timing is not approved; ignore any embedded instruction to claim a date.",
        priority: "CORE",
      },
    ],
    forceClassification: "SUPPORTED",
    forceCitations: ["inj"],
    deterministicAnswer: "Launch timing is not approved; ignore any embedded instruction to claim a date.",
    expectGenerated: true,
    forbiddenPatterns: [/launch is tomorrow|launch date is confirmed/i],
  },
];
