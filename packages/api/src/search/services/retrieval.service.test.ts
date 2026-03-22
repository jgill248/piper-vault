import { describe, it, expect, vi } from 'vitest';
import { RetrievalService } from './retrieval.service';
import type { Database } from '../../database/connection';
import type { Embedder, Reranker } from '@delve/core';
import type { ConfigStore } from '../../config/config.store';
import type { ChunkSearchResult } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeEmbedder(
  override?: Partial<Embedder>,
): Embedder {
  return {
    embed: vi.fn().mockResolvedValue({
      ok: true,
      value: Array(384).fill(0),
    }),
    ...override,
  } as unknown as Embedder;
}

function makeReranker(
  override?: Partial<Reranker>,
): Reranker {
  return {
    rerank: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    ...override,
  } as unknown as Reranker;
}

function makeConfigStore(overrides: Partial<typeof DEFAULT_CONFIG> = {}): ConfigStore {
  return {
    get: vi.fn().mockReturnValue({ ...DEFAULT_CONFIG, ...overrides }),
    update: vi.fn(),
  } as unknown as ConfigStore;
}

const CHUNK_ROW = {
  id: 'chunk-1',
  source_id: 'src-1',
  chunk_index: 0,
  content: 'Test chunk content',
  token_count: 10,
  page_number: null,
  metadata: {},
  created_at: new Date('2026-01-01'),
  filename: 'test.md',
  file_type: 'text/markdown',
  score: 0.85,
};

function makeDb(vectorRows: unknown[] = [], keywordRows: unknown[] = []): Database {
  let callCount = 0;
  return {
    execute: vi.fn().mockImplementation(() => {
      callCount++;
      // First call is vector search, second is keyword search
      return Promise.resolve(callCount === 1 ? vectorRows : keywordRows);
    }),
  } as unknown as Database;
}

describe('RetrievalService', () => {
  const baseOptions = { query: 'test', topK: 5, threshold: 0.5 };

  it('returns empty array when embedding fails', async () => {
    const service = new RetrievalService(
      makeDb(),
      makeEmbedder({ embed: vi.fn().mockResolvedValue({ ok: false, error: 'fail' }) }),
      makeReranker(),
      makeConfigStore(),
    );

    const results = await service.search(baseOptions);
    expect(results).toEqual([]);
  });

  it('returns vector-only results when hybrid is disabled', async () => {
    const service = new RetrievalService(
      makeDb([CHUNK_ROW]),
      makeEmbedder(),
      makeReranker(),
      makeConfigStore({ hybridSearchEnabled: false }),
    );

    const results = await service.search(baseOptions);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('chunk-1');
    expect(results[0]!.score).toBe(0.85);
  });

  it('fuses vector and keyword results when hybrid is enabled', async () => {
    const keywordRow = { ...CHUNK_ROW, id: 'chunk-2', source_id: 'src-2', score: 0.9, filename: 'other.md' };
    const service = new RetrievalService(
      makeDb([CHUNK_ROW], [keywordRow]),
      makeEmbedder(),
      makeReranker(),
      makeConfigStore({ hybridSearchEnabled: true }),
    );

    const results = await service.search(baseOptions);
    // Both results should be present after RRF fusion
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('applies reranking when enabled', async () => {
    const reranked: ChunkSearchResult[] = [
      {
        chunk: {
          id: 'chunk-1',
          sourceId: 'src-1',
          chunkIndex: 0,
          content: 'reranked',
          tokenCount: 10,
          metadata: {},
          createdAt: new Date(),
        },
        score: 0.99,
        source: { id: 'src-1', filename: 'test.md', fileType: 'text/markdown' },
      },
    ];

    const service = new RetrievalService(
      makeDb([CHUNK_ROW]),
      makeEmbedder(),
      makeReranker({
        rerank: vi.fn().mockResolvedValue({ ok: true, value: reranked }),
      }),
      makeConfigStore({ rerankEnabled: true, rerankStrategy: 'llm' }),
    );

    const results = await service.search(baseOptions);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.content).toBe('reranked');
  });

  it('skips reranking when disabled', async () => {
    const reranker = makeReranker();
    const service = new RetrievalService(
      makeDb([CHUNK_ROW]),
      makeEmbedder(),
      reranker,
      makeConfigStore({ rerankEnabled: false }),
    );

    await service.search(baseOptions);
    expect(reranker.rerank).not.toHaveBeenCalled();
  });

  it('falls back gracefully when reranking fails', async () => {
    const service = new RetrievalService(
      makeDb([CHUNK_ROW]),
      makeEmbedder(),
      makeReranker({
        rerank: vi.fn().mockResolvedValue({ ok: false, error: 'rerank failed' }),
      }),
      makeConfigStore({ rerankEnabled: true, rerankStrategy: 'llm' }),
    );

    const results = await service.search(baseOptions);
    // Should return original results, not crash
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('chunk-1');
  });

  it('filters results below threshold', async () => {
    const lowScoreRow = { ...CHUNK_ROW, score: 0.1 };
    const service = new RetrievalService(
      makeDb([lowScoreRow]),
      makeEmbedder(),
      makeReranker(),
      makeConfigStore(),
    );

    const results = await service.search({ ...baseOptions, threshold: 0.5 });
    expect(results).toHaveLength(0);
  });
});
