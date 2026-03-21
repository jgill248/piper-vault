import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SearchChunksHandler } from './search-chunks.handler';
import { SearchChunksQuery } from './search-chunks.query';
import type { RetrievalService } from '../services/retrieval.service';
import type { ChunkSearchResult } from '@delve/shared';

function makeChunkResult(score = 0.9): ChunkSearchResult {
  return {
    chunk: {
      id: 'chunk-uuid',
      sourceId: 'source-uuid',
      chunkIndex: 0,
      content: 'relevant content',
      tokenCount: 5,
      pageNumber: undefined,
      metadata: {},
      createdAt: new Date('2026-01-01'),
    },
    score,
    source: {
      id: 'source-uuid',
      filename: 'notes.txt',
      fileType: 'text/plain',
    },
  };
}

function makeRetrievalService(
  results: ChunkSearchResult[] = [],
  shouldThrow = false,
): RetrievalService {
  return {
    search: vi.fn().mockImplementation(async () => {
      if (shouldThrow) throw new Error('embedding failed');
      return results;
    }),
  } as unknown as RetrievalService;
}

describe('SearchChunksHandler', () => {
  it('returns mapped ChunkSearchResults from RetrievalService', async () => {
    const retrievalService = makeRetrievalService([makeChunkResult(0.95)]);
    const handler = new SearchChunksHandler(retrievalService);

    const results = await handler.execute(new SearchChunksQuery('test query', 5, 0.7));

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.content).toBe('relevant content');
    expect(results[0]?.score).toBe(0.95);
    expect(results[0]?.source.filename).toBe('notes.txt');
  });

  it('returns empty array when RetrievalService returns no results', async () => {
    const retrievalService = makeRetrievalService([]);
    const handler = new SearchChunksHandler(retrievalService);

    const results = await handler.execute(new SearchChunksQuery('test query', 5, 0.72));

    expect(results).toHaveLength(0);
  });

  it('throws BadRequestException when RetrievalService throws', async () => {
    const retrievalService = makeRetrievalService([], true);
    const handler = new SearchChunksHandler(retrievalService);

    await expect(handler.execute(new SearchChunksQuery('test query'))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('passes query options through to RetrievalService', async () => {
    const retrievalService = makeRetrievalService([]);
    const handler = new SearchChunksHandler(retrievalService);

    await handler.execute(
      new SearchChunksQuery('test query', 10, 0.8, ['src-1'], ['text/plain'], undefined, '2026-01-01', '2026-12-31'),
    );

    expect(retrievalService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test query',
        topK: 10,
        threshold: 0.8,
        sourceIds: ['src-1'],
        fileTypes: ['text/plain'],
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }),
    );
  });
});
