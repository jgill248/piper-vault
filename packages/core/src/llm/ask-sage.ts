import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { LlmProvider, LlmQuery, LlmResponse, LlmStreamChunk } from './provider.js';

const ASK_SAGE_BASE_URL = 'https://api.asksage.ai/server';
const LLM_FETCH_TIMEOUT_MS = 30_000;

/**
 * Shape of the JSON body sent to Ask Sage's /server/query endpoint.
 */
interface AskSageQueryBody {
  readonly message: string;
  readonly persona?: string;
  readonly model?: string;
}

/**
 * Minimal shape we read from the Ask Sage /server/query JSON response.
 * The actual API returns additional fields; we only extract what we need.
 */
interface AskSageQueryResponse {
  readonly message?: string;
  readonly response?: string;
  readonly model?: string;
  readonly tokens_used?: number;
}

/**
 * Minimal shape of the /server/get-models response.
 */
interface AskSageModelsResponse {
  readonly models?: readonly string[];
  readonly data?: readonly string[];
}

/**
 * AskSageProvider implements LlmProvider by calling the Ask Sage REST API.
 *
 * Authentication is via a long-lived token supplied at construction time and
 * sent in the `x-access-tokens` header on every request. Ask Sage tokens do
 * not expire, so no refresh logic is required.
 */
export class AskSageProvider implements LlmProvider {
  private readonly token: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(token: string, defaultModel = 'claude-3.5-sonnet', baseUrl?: string) {
    this.token = token;
    this.defaultModel = defaultModel;
    this.baseUrl = baseUrl ?? ASK_SAGE_BASE_URL;
  }

  /**
   * Sends a prompt to Ask Sage and returns the model's response.
   */
  async query(input: LlmQuery): Promise<Result<LlmResponse, string>> {
    const body: AskSageQueryBody = {
      message: input.prompt,
      ...(input.systemPrompt !== undefined ? { persona: input.systemPrompt } : {}),
      model: input.model ?? this.defaultModel,
    };

    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-tokens': this.token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LLM_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`AskSageProvider: network error during query — ${message}`);
    }

    if (!rawResponse.ok) {
      return err(
        `AskSageProvider: query failed with HTTP ${rawResponse.status} ${rawResponse.statusText}`,
      );
    }

    let json: AskSageQueryResponse;
    try {
      json = (await rawResponse.json()) as AskSageQueryResponse;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`AskSageProvider: failed to parse query response — ${message}`);
    }

    // Ask Sage can return the answer in either `message` or `response` fields.
    const content = json.message ?? json.response;
    if (content === undefined || content === '') {
      return err('AskSageProvider: response contained no message content');
    }

    // Ask Sage returns HTTP 200 for auth/rate-limit errors, embedding the error
    // string in the `message` field. Detect these and return an error result.
    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes('token is invalid') ||
      lowerContent.includes('invalid token') ||
      lowerContent.includes('unauthorized') ||
      lowerContent.includes('access denied') ||
      lowerContent.includes('rate limit')
    ) {
      return err(`AskSageProvider: ${content}`);
    }

    return ok({
      content,
      model: json.model ?? input.model ?? this.defaultModel,
      tokensUsed: json.tokens_used,
    });
  }

  /**
   * Ask Sage does not support streaming — fall back to buffered response
   * emitted as a single chunk.
   */
  async *streamQuery(input: LlmQuery): AsyncIterable<LlmStreamChunk> {
    const result = await this.query(input);
    if (!result.ok) {
      yield { delta: `[Error: ${result.error}]`, done: true };
      return;
    }
    yield { delta: result.value.content, done: false };
    yield { delta: '', done: true, model: result.value.model, tokensUsed: result.value.tokensUsed };
  }

  /**
   * Fetches the list of available models from Ask Sage.
   */
  async getModels(): Promise<Result<readonly string[], string>> {
    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.baseUrl}/get-models`, {
        method: 'GET',
        headers: {
          'x-access-tokens': this.token,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`AskSageProvider: network error fetching models — ${message}`);
    }

    if (!rawResponse.ok) {
      return err(
        `AskSageProvider: get-models failed with HTTP ${rawResponse.status} ${rawResponse.statusText}`,
      );
    }

    let json: AskSageModelsResponse;
    try {
      json = (await rawResponse.json()) as AskSageModelsResponse;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`AskSageProvider: failed to parse models response — ${message}`);
    }

    // The API may return models under `models` or `data`.
    const models = json.models ?? json.data;
    if (models === undefined) {
      return err('AskSageProvider: models response contained no model list');
    }

    return ok(models);
  }
}
