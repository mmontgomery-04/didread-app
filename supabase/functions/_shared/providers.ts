// The provider adapter (SPEC section 6, "Provider and model"): one small function per AI provider,
// all with the same shape. Which provider and model to use comes from backend config (secrets),
// never from code, so switching is a config change. Uses plain fetch, so it runs both in the
// Supabase function and in PC scripts (the batch 8 calibration script).
import { AI_TIMEOUT_MS, MAX_OUTPUT_TOKENS } from './contract.ts';

export const PROVIDERS = ['openai', 'gemini', 'anthropic'] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface ModelConfig {
  provider: Provider;
  model: string;
  apiKey: string;
}

export interface ModelReply {
  text: string;
  /** Token counts reported by the provider, for cost estimates (batch 8). */
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Each provider's API key lives in its own secret. */
const KEY_NAMES: Record<Provider, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/**
 * Reads SCORING_PROVIDER, SCORING_MODEL and that provider's key. Returns a message instead of a
 * config if anything is missing (the function then saves the attempt as unscored and logs why).
 */
export function readModelConfig(get: (name: string) => string | undefined): ModelConfig | string {
  const provider = get('SCORING_PROVIDER')?.trim().toLowerCase();
  const model = get('SCORING_MODEL')?.trim();
  if (!provider || !(PROVIDERS as readonly string[]).includes(provider)) {
    return `SCORING_PROVIDER must be one of: ${PROVIDERS.join(', ')}.`;
  }
  if (!model) return 'SCORING_MODEL is not set.';
  const keyName = KEY_NAMES[provider as Provider];
  const apiKey = get(keyName)?.trim();
  if (!apiKey) return `${keyName} is not set.`;
  return { provider: provider as Provider, model, apiKey };
}

// The JSON shape the model must return. Used where a provider can enforce it.
function outputSchema(criterionIds: readonly string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['criteria', 'flags', 'feedback'],
    properties: {
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'score'],
          properties: {
            id: { type: 'string', enum: [...criterionIds] },
            score: { type: 'integer', enum: [0, 1, 2] },
          },
        },
      },
      flags: {
        type: 'object',
        additionalProperties: false,
        required: ['off_topic', 'not_an_answer'],
        properties: { off_topic: { type: 'boolean' }, not_an_answer: { type: 'boolean' } },
      },
      feedback: { type: 'string' },
    },
  };
}

interface Call {
  system: string;
  user: string;
  criterionIds: readonly string[];
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return (await res.json()) as Record<string, any>;
}

const callers: Record<Provider, (config: ModelConfig, call: Call, signal: AbortSignal) => Promise<ModelReply>> = {
  async openai(config, call, signal) {
    const data = await postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${config.apiKey}` },
      {
        model: config.model,
        messages: [
          { role: 'system', content: call.system },
          { role: 'user', content: call.user },
        ],
        temperature: 0,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'score', strict: true, schema: outputSchema(call.criterionIds) },
        },
      },
      signal,
    );
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  },

  async gemini(config, call, signal) {
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      { 'x-goog-api-key': config.apiKey },
      {
        systemInstruction: { parts: [{ text: call.system }] },
        contents: [{ role: 'user', parts: [{ text: call.user }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
        },
      },
      signal,
    );
    const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
    return {
      text: parts.map((p) => p.text ?? '').join(''),
      inputTokens: data.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    };
  },

  async anthropic(config, call, signal) {
    const data = await postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
      {
        model: config.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
        system: call.system,
        messages: [{ role: 'user', content: call.user }],
      },
      signal,
    );
    const blocks: { type: string; text?: string }[] = data.content ?? [];
    return {
      text: blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    };
  },
};

/**
 * Calls the configured model: 15-second timeout, then one retry (SPEC section 6).
 * Throws if both tries fail; the caller turns that into "unscored".
 */
export async function callModel(config: ModelConfig, call: Call): Promise<ModelReply> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callers[config.provider](config, call, AbortSignal.timeout(AI_TIMEOUT_MS));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
