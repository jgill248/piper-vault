import type { Result, ChunkSearchResult, SearchRequest } from '@delve/shared';

export interface Retriever {
  search(
    queryEmbedding: readonly number[],
    options: Pick<SearchRequest, 'topK' | 'threshold' | 'sourceIds' | 'fileTypes'>,
  ): Promise<Result<readonly ChunkSearchResult[], string>>;
}
