import type { InterpretationAuthorityItem } from "../../src/receiver/interpretation-authority.js";
import type { SemanticClassification } from "../../src/receiver/semantic/proposal-schema.js";

export type SemanticEvalCase = {
  id: string;
  question: string;
  items: InterpretationAuthorityItem[];
  expectedClassification: SemanticClassification | "DERIVED";
  expectedCitationIds?: string[];
  rawTranscriptSecret?: string;
};

export const semanticEvalCases: SemanticEvalCase[] = [
  {
    id: "Q1",
    question: "Have we picked who handles sign-in?",
    items: [
      {
        id: "auth-open",
        type: "OPEN",
        statement: "The authentication provider remains undecided.",
        priority: "CORE",
      },
    ],
    expectedClassification: "OPEN",
    expectedCitationIds: ["auth-open"],
  },
  {
    id: "Q2",
    question: "Are we starting on the web?",
    items: [
      {
        id: "web-mvp",
        type: "CONFIRMED",
        statement: "The MVP will launch as a browser-based product first.",
        priority: "CORE",
      },
    ],
    expectedClassification: "SUPPORTED",
    expectedCitationIds: ["web-mvp"],
  },
  {
    id: "Q3",
    question: "What will the monthly subscription cost?",
    items: [{ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed.", priority: "CORE" }],
    expectedClassification: "UNKNOWN",
    expectedCitationIds: [],
  },
  {
    id: "Q4",
    question: "Are we shipping iOS/Android first?",
    items: [
      {
        id: "mobile-rejected",
        type: "REJECTED",
        statement: "Native mobile launch was rejected for the first release.",
        priority: "CORE",
      },
    ],
    expectedClassification: "SUPPORTED",
    expectedCitationIds: ["mobile-rejected"],
  },
  {
    id: "Q5",
    question: "Has email login been finalized?",
    items: [
      {
        id: "email-tentative",
        type: "TENTATIVE",
        statement: "Email login is tentatively preferred.",
        priority: "CORE",
      },
    ],
    expectedClassification: "SUPPORTED",
    expectedCitationIds: ["email-tentative"],
  },
  {
    id: "Q6",
    question: "What do users pay?",
    items: [
      {
        id: "api-auth",
        type: "CONFIRMED",
        statement: "API authentication uses bearer tokens.",
        priority: "CORE",
      },
    ],
    expectedClassification: "UNKNOWN",
    expectedCitationIds: [],
  },
  {
    id: "Q7",
    question: "Is the secret launch code ALPHA-99?",
    items: [{ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed.", priority: "CORE" }],
    expectedClassification: "UNKNOWN",
    expectedCitationIds: [],
    rawTranscriptSecret: "ALPHA-99 appears only in raw transcript",
  },
  {
    id: "Q8",
    question: "What is the canonical plan for version one?",
    items: [{ id: "v1", type: "CONFIRMED", statement: "Version one keeps browser-first scope.", priority: "CORE" }],
    expectedClassification: "SUPPORTED",
    expectedCitationIds: ["v1"],
  },
  {
    id: "Q9",
    question: "Which AWS region will we deploy to?",
    items: [{ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed.", priority: "CORE" }],
    expectedClassification: "UNKNOWN",
    expectedCitationIds: [],
  },
  {
    id: "Q10",
    question: "Should we use Redis or Memcached for caching?",
    items: [{ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed.", priority: "CORE" }],
    expectedClassification: "UNKNOWN",
    expectedCitationIds: [],
  },
];
