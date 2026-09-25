export type OpenAiExtractionConfig = {
  apiKey: string;
  model: string;
};

export function readOpenAiExtractionConfig(): OpenAiExtractionConfig | undefined {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) return undefined;
  return { apiKey, model };
}

export function isOpenAiExtractionConfigured(): boolean {
  return readOpenAiExtractionConfig() !== undefined;
}
