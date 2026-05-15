import { callLLMJson, type JsonSchema } from "@/lib/llm";

// Backward-compatible alias while code migrates to provider-agnostic naming.
export async function callOpenAIJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: import("zod").z.ZodType<T>;
}): Promise<T> {
  return callLLMJson(options);
}

export type { JsonSchema };
