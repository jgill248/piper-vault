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

export interface LlmProvider {
  query(input: LlmQuery): Promise<Result<LlmResponse, string>>;
  getModels(): Promise<Result<readonly string[], string>>;
}
