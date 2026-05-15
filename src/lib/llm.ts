import { z } from "zod";

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

type LLMProvider = "openai" | "cerebras" | "groq";

type OpenAIOutputContent = {
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAIOutputContent[];
};

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
};

type CerebrasCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const CEREBRAS_CHAT_COMPLETIONS_URL =
  "https://api.cerebras.ai/v1/chat/completions";
const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_CEREBRAS_MODEL = "llama-3.3-70b";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM response was not valid JSON");
  }

  return schema.parse(parsed);
}

function getProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  if (provider === "openai" || provider === "cerebras" || provider === "groq") {
    return provider;
  }
  throw new Error(
    `Unsupported LLM_PROVIDER "${provider}". Use "openai", "cerebras", or "groq".`,
  );
}

function extractOpenAIText(payload: OpenAIResponsesPayload): string {
  if (payload.output_text) {
    return payload.output_text;
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }

  return text;
}

async function callOpenAIJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: z.ZodType<T>;
}): Promise<T> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: options.systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: options.userMessage }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: options.schemaName,
          schema: options.jsonSchema,
          strict: true,
        },
      },
    }),
  });

  const payload = (await response.json()) as OpenAIResponsesPayload;

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${payload.error?.message ?? response.statusText}`,
    );
  }

  return parseJson(extractOpenAIText(payload), options.zodSchema);
}

async function callCerebrasJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: z.ZodType<T>;
}): Promise<T> {
  const response = await fetch(CEREBRAS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("CEREBRAS_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.CEREBRAS_MODEL ?? DEFAULT_CEREBRAS_MODEL,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userMessage },
      ],
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.jsonSchema,
        },
      },
    }),
  });

  const payload = (await response.json()) as CerebrasCompletionPayload;

  if (!response.ok) {
    throw new Error(
      `Cerebras API error: ${payload.error?.message ?? response.statusText}`,
    );
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Cerebras response did not include output text");
  }

  return parseJson(text, options.zodSchema);
}

async function callGroqJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: z.ZodType<T>;
}): Promise<T> {
  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userMessage },
      ],
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.jsonSchema,
        },
      },
    }),
  });

  const payload = (await response.json()) as CerebrasCompletionPayload;

  if (!response.ok) {
    throw new Error(
      `Groq API error: ${payload.error?.message ?? response.statusText}`,
    );
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq response did not include output text");
  }

  return parseJson(text, options.zodSchema);
}

export async function callLLMJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: z.ZodType<T>;
}): Promise<T> {
  const provider = getProvider();

  if (provider === "cerebras") {
    return callCerebrasJson(options);
  }

  if (provider === "groq") {
    return callGroqJson(options);
  }

  return callOpenAIJson(options);
}
