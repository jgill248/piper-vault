import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SearchChunksHandler } from './search-chunks.handler';
import { SearchChunksQuery } from './search-chunks.query';
import type { Embedder } from '@delve/core';
import type { Database } from '../../database/connection';

function makeEmbedder(override?: Partial<Embedder>): Embedder {
  return {
    dimensions: 384,
    embed: vi.fn().mockResolvedValue({ ok: true, value: new Array(384).fill(0.1) }),
    embedBatch: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    ...override,
  };
}

function makeChunkRow(score = 0.9) {
  return {
    id: 'chunk-uuid',
    source_id: 'source-uuid',
    chunk_index: 0,
    content: 'relevant content',
    token_count: 5,
    page_number: null,
    metadata: {},
    created_at: new Date('2026-01-01'),
    filename: 'notes.txt',
    file_type: 'text/plain',
    score,
  };
}

function makeDb(rows: ReturnType<typeof makeChunkRow>[]): Database {
  return {
    execute: vi.fn().mockResolvedValue(rows),
  } as unknown as Database;
}

describe('SearchChunksHandler', () => {
  it('returns mapped ChunkSearchResults above threshold', async () => {
    const db = makeDb([makeChunkRow(0.95)]);
    const embedder = makeEmbedder();
    const handler = new SearchChunksHandler(db, embedder);

    const results = await handler.execute(new SearchChunksQuery('test query', 5, 0.7));

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.content).toBe('relevant content');
    expect(results[0]?.score).toBe(0.95);
    expect(results[0]?.source.filename).toBe('notes.txt');
  });

  it('filters out results below the threshold', async () => {
    const db = makeDb([makeChunkRow(0.3)]); // score below default threshold
    const embedder = makeEmbedder();
    const handler = new SearchChunksHandler(db, embedder);

    const results = await handler.execute(new SearchChunksQuery('test query', 5, 0.72));

    expect(results).toHaveLength(0);
  });

  it('throws BadRequestException when embedding fails', async () => {
    const db = makeDb([]);
    const embedder = makeEmbedder({
      embed: vi.fn().mockResolvedValue({ ok: false, error: 'model unavailable' }),
    });
    const handler = new SearchChunksHandler(db, embedder);

    await expect(handler.execute(new SearchChunksQuery('test query'))).rejects.toThrow(
      BadRequestException,
    );
  });
});
