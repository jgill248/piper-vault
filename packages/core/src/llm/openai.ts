import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { LlmProvider, LlmQuery, LlmResponse } from './provider.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const LLM_FETCH_TIMEOUT_MS = 30_000;

/**
 * A single message in the OpenAI Chat Completions format.
 */
interface OpenAiMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Shape of the JSON body sent to the OpenAI Chat Completions API.
 */
interface OpenAiChatBody {
  readonly model: string;
  readonly max_tokens?: number;
  readonly messages: readonly OpenAiMessage[];
}

/**
 * Minimal shape we read from the OpenAI Chat Completions API response.
 */
interface OpenAiChatResponse {
  readonly id?: string;
  readonly model?: string;
  readonly choices?: readonly {
    readonly message?: { readonly role?: string; readonly content?: string };
    readonly finish_reason?: string;
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly error?: {
    readonly message?: string;
    readonly type?: string;
    readonly code?: string;
  };
}

/**
 * OpenAiProvider implements LlmProvider by calling the OpenAI Chat Completions API
 * directly via fetch. No SDK dependency — raw HTTP only.
 *
 * Authentication is via an API key supplied at construction time and sent in the
 * `Authorization: Bearer` header on every request.
 */
export class OpenAiProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, defaultModel = 'gpt-4o', baseUrl?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.baseUrl = baseUrl ?? OPENAI_BASE_URL;
  }

  /**
   * Sends a prompt to the OpenAI Chat Completions API and returns the model's response.
   */
  async query(input: LlmQuery): Promise<Result<LlmResponse, string>> {
    const messages: OpenAiMessage[] = [];

    if (input.systemPrompt !== undefined) {
      messages.push({ role: 'system', content: input.systemPrompt });
    }
    messages.push({ role: 'user', content: input.prompt });

    const body: OpenAiChatBody = {
      model: input.model ?? this.defaultModel,
      ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
      messages,
    };

    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LLM_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OpenAiProvider: network error during query — ${message}`);
    }

    let json: OpenAiChatResponse;
    try {
      json = (await rawResponse.json()) as OpenAiChatResponse;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OpenAiProvider: failed to parse query response — ${message}`);
    }

    if (!rawResponse.ok) {
      const detail = json.error?.message ?? rawResponse.statusText;
      return err(
        `OpenAiProvider: query failed with HTTP ${rawResponse.status} — ${detail}`,
      );
    }

    const content = json.choices?.[0]?.message?.content;
    if (content === undefined || content === '') {
      return err('OpenAiProvider: response contained no message content');
    }

    return ok({
      content,
      model: json.model ?? input.model ?? this.defaultModel,
      tokensUsed: json.usage?.completion_tokens,
    });
  }

  /**
   * Returns a static list of known OpenAI models.
   */
  async getModels(): Promise<Result<readonly string[], string>> {
    return ok(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] as const);
  }
}
