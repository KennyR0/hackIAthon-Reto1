import { z } from "zod";

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

type LLMProvider = "openai" | "cerebras" | "groq" | "gemini";

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
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_CEREBRAS_MODEL = "llama-3.3-70b";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MAX_RATE_LIMIT_RETRIES = 2;
const GROQ_MAX_RETRY_DELAY_MS = 5_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response: Response, message?: string): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1_000);
    }
  }

  const match = message?.match(/try again in\s+([\d.]+)\s*(ms|s)/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return match[2].toLowerCase() === "s"
    ? Math.ceil(value * 1_000)
    : Math.ceil(value);
}

function getProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  if (
    provider === "openai" ||
    provider === "cerebras" ||
    provider === "groq" ||
    provider === "gemini"
  ) {
    return provider;
  }
  throw new Error(
    `Unsupported LLM_PROVIDER "${provider}". Use "openai", "cerebras", "groq", or "gemini".`,
  );
}

function getFallbackProvider(): LLMProvider | null {
  const fallbackRaw = process.env.LLM_FALLBACK_PROVIDER?.toLowerCase().trim();
  if (!fallbackRaw) {
    return null;
  }

  if (
    fallbackRaw === "openai" ||
    fallbackRaw === "cerebras" ||
    fallbackRaw === "groq" ||
    fallbackRaw === "gemini"
  ) {
    return fallbackRaw;
  }

  throw new Error(
    `Unsupported LLM_FALLBACK_PROVIDER "${fallbackRaw}". Use "openai", "cerebras", "groq", or "gemini".`,
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
  for (let attempt = 0; attempt <= GROQ_MAX_RATE_LIMIT_RETRIES; attempt++) {
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
      const message = payload.error?.message ?? response.statusText;
      const retryDelayMs = getRetryDelayMs(response, message);

      if (
        response.status === 429 &&
        retryDelayMs !== null &&
        retryDelayMs <= GROQ_MAX_RETRY_DELAY_MS &&
        attempt < GROQ_MAX_RATE_LIMIT_RETRIES
      ) {
        await sleep(retryDelayMs + 250);
        continue;
      }

      throw new Error(`Groq API error: ${message}`);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Groq response did not include output text");
    }

    return parseJson(text, options.zodSchema);
  }

  throw new Error("Groq API error: rate limit retries exhausted");
}

type GeminiContentPart = { text?: string };
type GeminiCandidate = { content?: { parts?: GeminiContentPart[] } };
type GeminiPayload = {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
};

async function callGeminiJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: z.ZodType<T>;
}): Promise<T> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `${GEMINI_BASE_URL}/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${options.systemPrompt}\n\n${options.userMessage}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: options.jsonSchema,
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiPayload;

  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${payload.error?.message ?? response.statusText}`,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini response did not include output text");
  }

  return parseJson(text, options.zodSchema);
}

async function callByProvider<T>(
  provider: LLMProvider,
  options: {
    systemPrompt: string;
    userMessage: string;
    schemaName: string;
    jsonSchema: JsonSchema;
    zodSchema: z.ZodType<T>;
  },
): Promise<T> {
  if (provider === "openai") {
    return callOpenAIJson(options);
  }
  if (provider === "cerebras") {
    return callCerebrasJson(options);
  }
  if (provider === "groq") {
    return callGroqJson(options);
  }
  return callGeminiJson(options);
}

export async function callLLMJson<T>(options: {
  systemPrompt: string;
  userMessage: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  zodSchema: z.ZodType<T>;
}): Promise<T> {
  const primaryProvider = getProvider();
  const fallbackProvider = getFallbackProvider();

  try {
    return await callByProvider(primaryProvider, options);
  } catch (primaryError) {
    if (!fallbackProvider || fallbackProvider === primaryProvider) {
      throw primaryError;
    }

    try {
      return await callByProvider(fallbackProvider, options);
    } catch (fallbackError) {
      const primaryMessage =
        primaryError instanceof Error
          ? primaryError.message
          : "Unknown primary provider error";
      const fallbackMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown fallback provider error";
      throw new Error(
        `Primary provider "${primaryProvider}" failed: ${primaryMessage}. Fallback provider "${fallbackProvider}" failed: ${fallbackMessage}.`,
      );
    }
  }
}
