import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { IngestSourceHandler } from './ingest-source.handler';
import { IngestSourceCommand } from './ingest-source.command';
import type { IngestionPipeline } from '@delve/core';
import type { Embedder } from '@delve/core';
import type { Database } from '../../database/connection';

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

function makeBuffer(content = 'hello world'): Buffer {
  return Buffer.from(content, 'utf-8');
}

function makeIngestionPipeline(override?: Partial<IngestionPipeline>): IngestionPipeline {
  return {
    ingest: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        chunks: [
          { index: 0, content: 'hello world', tokenCount: 2, metadata: {} },
        ],
        contentHash: 'abc123',
        metadata: { filename: 'test.txt', mimeType: 'text/plain' },
      },
    }),
    ...override,
  };
}

function makeEmbedder(override?: Partial<Embedder>): Embedder {
  return {
    dimensions: 384,
    embed: vi.fn().mockResolvedValue({ ok: true, value: new Array(384).fill(0.1) }),
    embedBatch: vi.fn().mockResolvedValue({ ok: true, value: [new Array(384).fill(0.1)] }),
    ...override,
  };
}

function makeDb(): Database {
  const returningMock = vi.fn().mockResolvedValue([{ id: 'source-uuid-1' }]);
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // no existing source
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: returningMock }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  } as unknown as Database;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IngestSourceHandler', () => {
  let handler: IngestSourceHandler;
  let db: Database;
  let pipeline: IngestionPipeline;
  let embedder: Embedder;

  beforeEach(() => {
    db = makeDb();
    pipeline = makeIngestionPipeline();
    embedder = makeEmbedder();
    handler = new IngestSourceHandler(db, pipeline, embedder);
  });

  it('returns ok result with sourceId and chunkCount on success', async () => {
    const command = new IngestSourceCommand(
      makeBuffer(),
      'test.txt',
      'text/plain',
      11,
    );

    const result = await handler.execute(command);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceId).toBe('source-uuid-1');
      expect(result.value.chunkCount).toBe(1);
    }
  });

  it('returns err result when ingestion pipeline fails', async () => {
    pipeline = makeIngestionPipeline({
      ingest: vi.fn().mockResolvedValue({
        ok: false,
        error: 'No parser available for MIME type "application/x-unknown"',
      }),
    });
    handler = new IngestSourceHandler(db, pipeline, embedder);

    const command = new IngestSourceCommand(
      makeBuffer(),
      'test.xyz',
      'application/x-unknown',
      11,
    );

    const result = await handler.execute(command);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No parser available');
    }
  });

  it('returns err result when embedding fails', async () => {
    embedder = makeEmbedder({
      embedBatch: vi.fn().mockResolvedValue({ ok: false, error: 'Embedding model unavailable' }),
    });
    handler = new IngestSourceHandler(db, pipeline, embedder);

    const command = new IngestSourceCommand(makeBuffer(), 'test.txt', 'text/plain', 11);

    const result = await handler.execute(command);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Embedding failed');
    }
  });

  it('throws ConflictException when a source with the same content_hash already exists', async () => {
    // Override select to return an existing source
    db = {
      ...db,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-source' }]),
          }),
        }),
      }),
    } as unknown as Database;

    handler = new IngestSourceHandler(db, pipeline, embedder);

    const command = new IngestSourceCommand(makeBuffer(), 'test.txt', 'text/plain', 11);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
  });
});
