import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { LlmProvider, LlmQuery, LlmResponse } from './provider.js';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const LLM_FETCH_TIMEOUT_MS = 30_000;

/**
 * Shape of the JSON body sent to the Anthropic Messages API.
 */
interface AnthropicMessageBody {
  readonly model: string;
  readonly max_tokens: number;
  readonly system?: string;
  readonly messages: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
}

/**
 * Minimal shape we read from the Anthropic Messages API response.
 */
interface AnthropicMessageResponse {
  readonly id?: string;
  readonly model?: string;
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
  };
  readonly error?: {
    readonly type?: string;
    readonly message?: string;
  };
}

/**
 * AnthropicProvider implements LlmProvider by calling the Anthropic Messages API
 * directly via fetch. No SDK dependency — raw HTTP only.
 *
 * Authentication is via an API key supplied at construction time and sent in the
 * `x-api-key` header on every request.
 */
export class AnthropicProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, defaultModel = 'claude-sonnet-4-20250514', baseUrl?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.baseUrl = baseUrl ?? ANTHROPIC_BASE_URL;
  }

  /**
   * Sends a prompt to the Anthropic Messages API and returns the model's response.
   */
  async query(input: LlmQuery): Promise<Result<LlmResponse, string>> {
    const body: AnthropicMessageBody = {
      model: input.model ?? this.defaultModel,
      max_tokens: input.maxTokens ?? 4096,
      ...(input.systemPrompt !== undefined ? { system: input.systemPrompt } : {}),
      messages: [{ role: 'user', content: input.prompt }],
    };

    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LLM_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`AnthropicProvider: network error during query — ${message}`);
    }

    let json: AnthropicMessageResponse;
    try {
      json = (await rawResponse.json()) as AnthropicMessageResponse;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`AnthropicProvider: failed to parse query response — ${message}`);
    }

    if (!rawResponse.ok) {
      const detail = json.error?.message ?? rawResponse.statusText;
      return err(
        `AnthropicProvider: query failed with HTTP ${rawResponse.status} — ${detail}`,
      );
    }

    // Extract text from the first content block of type 'text'.
    const textBlock = json.content?.find((block) => block.type === 'text');
    const content = textBlock?.text;
    if (content === undefined || content === '') {
      return err('AnthropicProvider: response contained no text content');
    }

    return ok({
      content,
      model: json.model ?? input.model ?? this.defaultModel,
      tokensUsed: json.usage?.output_tokens,
    });
  }

  /**
   * Returns a static list of known Anthropic models.
   * The Anthropic API does not expose a public model listing endpoint.
   */
  async getModels(): Promise<Result<readonly string[], string>> {
    return ok([
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-20250514',
    ] as const);
  }
}
