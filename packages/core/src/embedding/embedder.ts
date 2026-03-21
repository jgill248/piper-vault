import type { Result } from '@delve/shared';

export interface Embedder {
  readonly dimensions: number;
  embed(text: string): Promise<Result<readonly number[], string>>;
  embedBatch(texts: readonly string[]): Promise<Result<readonly (readonly number[])[], string>>;
}
