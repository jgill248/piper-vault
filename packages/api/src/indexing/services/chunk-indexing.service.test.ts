import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkIndexingService } from './chunk-indexing.service';
import type { Embedder, TextChunk } from '@delve/core';
import type { Database } from '../../database/connection';

function makeEmbedder(override?: Partial<Embedder>): Embedder {
  return {
    dimensions: 384,
    embed: vi.fn().mockResolvedValue({ ok: true, value: new Array(384).fill(0.1) }),
    embedBatch: vi.fn().mockResolvedValue({
      ok: true,
      value: [new Array(384).fill(0.1), new Array(384).fill(0.2)],
    }),
    ...override,
  };
}

function makeChunk(index: number, metadata: Record<string, unknown> = {}): TextChunk {
  return { index, content: `chunk ${index}`, tokenCount: 2, metadata };
}

describe('ChunkIndexingService', () => {
  let valuesMock: ReturnType<typeof vi.fn>;
  let db: Database;
  let embedder: Embedder;

  beforeEach(() => {
    valuesMock = vi.fn().mockResolvedValue([]);
    db = {
      insert: vi.fn().mockReturnValue({ values: valuesMock }),
    } as unknown as Database;
    embedder = makeEmbedder();
  });

  it('embeds and inserts chunks, returning the count', async () => {
    const service = new ChunkIndexingService(db, embedder);

    const result = await service.embedAndStoreChunks('source-1', [
      makeChunk(0),
      makeChunk(1),
    ]);

    expect(result).toEqual({ ok: true, value: 2 });
    expect(embedder.embedBatch).toHaveBeenCalledWith(['chunk 0', 'chunk 1']);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    const rows = valuesMock.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ sourceId: 'source-1', chunkIndex: 0, content: 'chunk 0' });
  });

  it('maps pageNumber from chunk metadata when present', async () => {
    const service = new ChunkIndexingService(db, embedder);

    await service.embedAndStoreChunks('source-1', [
      makeChunk(0, { pageNumber: 3 }),
      makeChunk(1),
    ]);

    const rows = valuesMock.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows[0]!['pageNumber']).toBe(3);
    expect(rows[1]!['pageNumber']).toBeUndefined();
  });

  it('is a no-op for empty input (no embed, no insert)', async () => {
    const service = new ChunkIndexingService(db, embedder);

    const result = await service.embedAndStoreChunks('source-1', []);

    expect(result).toEqual({ ok: true, value: 0 });
    expect(embedder.embedBatch).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns an embedding error Result without inserting', async () => {
    embedder = makeEmbedder({
      embedBatch: vi.fn().mockResolvedValue({ ok: false, error: 'model unavailable' }),
    });
    const service = new ChunkIndexingService(db, embedder);

    const result = await service.embedAndStoreChunks('source-1', [makeChunk(0)]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Embedding failed');
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns a storage error Result when the insert throws', async () => {
    valuesMock.mockRejectedValue(new Error('connection lost'));
    const service = new ChunkIndexingService(db, embedder);

    const result = await service.embedAndStoreChunks('source-1', [makeChunk(0)]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to store chunks');
      expect(result.error).toContain('connection lost');
    }
  });
});
