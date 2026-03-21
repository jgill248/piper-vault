import type { Result, ChunkSearchResult } from '@delve/shared';

export interface Reranker {
  rerank(
    query: string,
    candidates: readonly ChunkSearchResult[],
    topN: number,
  ): Promise<Result<ChunkSearchResult[], string>>;
}
