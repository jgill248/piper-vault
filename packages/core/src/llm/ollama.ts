import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { LlmProvider, LlmQuery, LlmResponse } from './provider.js';

/**
 * A single message in the Ollama Chat API format.
 */
interface OllamaMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Shape of the JSON body sent to the Ollama /api/chat endpoint.
 */
interface OllamaChatBody {
  readonly model: string;
  readonly messages: readonly OllamaMessage[];
  readonly stream: false;
}

/**
 * Minimal shape we read from the Ollama /api/chat response.
 */
interface OllamaChatResponse {
  readonly model?: string;
  readonly message?: {
    readonly role?: string;
    readonly content?: string;
  };
  readonly done?: boolean;
  readonly eval_count?: number;
  readonly error?: string;
}

/**
 * Minimal shape we read from the Ollama /api/tags response.
 */
interface OllamaTagsResponse {
  readonly models?: readonly {
    readonly name?: string;
    readonly model?: string;
  }[];
  readonly error?: string;
}

/**
 * OllamaProvider implements LlmProvider by calling the Ollama local REST API
 * directly via fetch. No SDK dependency — raw HTTP only.
 *
 * Ollama runs locally (default http://localhost:11434) and requires no
 * authentication. The base URL can be overridden for non-standard deployments.
 */
export class OllamaProvider implements LlmProvider {
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(baseUrl = 'http://localhost:11434', defaultModel = 'llama3.2') {
    // Normalize: strip trailing slash for consistent URL building.
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
  }

  /**
   * Sends a prompt to the Ollama /api/chat endpoint and returns the model's response.
   */
  async query(input: LlmQuery): Promise<Result<LlmResponse, string>> {
    const messages: OllamaMessage[] = [];

    if (input.systemPrompt !== undefined) {
      messages.push({ role: 'system', content: input.systemPrompt });
    }
    messages.push({ role: 'user', content: input.prompt });

    const body: OllamaChatBody = {
      model: input.model ?? this.defaultModel,
      messages,
      stream: false,
    };

    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OllamaProvider: network error during query — ${message}`);
    }

    let json: OllamaChatResponse;
    try {
      json = (await rawResponse.json()) as OllamaChatResponse;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OllamaProvider: failed to parse query response — ${message}`);
    }

    if (!rawResponse.ok) {
      const detail = json.error ?? rawResponse.statusText;
      return err(
        `OllamaProvider: query failed with HTTP ${rawResponse.status} — ${detail}`,
      );
    }

    const content = json.message?.content;
    if (content === undefined || content === '') {
      return err('OllamaProvider: response contained no message content');
    }

    return ok({
      content,
      model: json.model ?? input.model ?? this.defaultModel,
      tokensUsed: json.eval_count,
    });
  }

  /**
   * Fetches the list of locally available models from the Ollama /api/tags endpoint.
   */
  async getModels(): Promise<Result<readonly string[], string>> {
    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OllamaProvider: network error fetching models — ${message}`);
    }

    if (!rawResponse.ok) {
      return err(
        `OllamaProvider: get-models failed with HTTP ${rawResponse.status} ${rawResponse.statusText}`,
      );
    }

    let json: OllamaTagsResponse;
    try {
      json = (await rawResponse.json()) as OllamaTagsResponse;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OllamaProvider: failed to parse models response — ${message}`);
    }

    if (json.models === undefined) {
      return err('OllamaProvider: models response contained no model list');
    }

    // Each entry has a `name` field (e.g. "llama3.2:latest"). Filter out any
    // entries that lack a name.
    const names = json.models
      .map((m) => m.name ?? m.model)
      .filter((n): n is string => n !== undefined && n !== '');

    return ok(names);
  }
}
