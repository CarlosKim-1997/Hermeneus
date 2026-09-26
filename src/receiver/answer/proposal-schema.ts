import { z } from "zod";

export type GeneratedSentence = {
  text: string;
  citationIds: string[];
};

export type GeneratedAnswerProposal = {
  sentences: GeneratedSentence[];
};

export const generatedAnswerProposalSchema = z.object({
  sentences: z.array(
    z.object({
      text: z.string().min(1),
      citationIds: z.array(z.string()).min(1),
    }),
  ),
});

export const groundingVerdicts = ["GROUNDED", "UNSUPPORTED"] as const;
export type GroundingVerdict = (typeof groundingVerdicts)[number];

export type GroundingVerification = {
  verdict: GroundingVerdict;
  sentenceResults: Array<{
    index: number;
    grounded: boolean;
    citationIds: string[];
  }>;
};

export const groundingVerificationSchema = z.object({
  verdict: z.enum(groundingVerdicts),
  sentenceResults: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      grounded: z.boolean(),
      citationIds: z.array(z.string()),
    }),
  ),
});
