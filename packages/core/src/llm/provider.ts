import type { Result } from '@delve/shared';

export interface LlmQuery {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly maxTokens?: number;
}

export interface LlmResponse {
  readonly content: string;
  readonly model: string;
  readonly tokensUsed?: number;
}

/**
 * A chunk emitted during streaming. `delta` contains the incremental text.
 * When `done` is true, the stream is finished and `model`/`tokensUsed` are populated.
 */
export interface LlmStreamChunk {
  readonly delta: string;
  readonly done: boolean;
  readonly model?: string;
  readonly tokensUsed?: number;
}

export interface LlmProvider {
  query(input: LlmQuery): Promise<Result<LlmResponse, string>>;
  getModels(): Promise<Result<readonly string[], string>>;
  /**
   * Stream a response from the LLM. Returns an async iterable of chunks.
   * Providers that don't support streaming fall back to yielding a single chunk.
   */
  streamQuery(input: LlmQuery): AsyncIterable<LlmStreamChunk>;
}
