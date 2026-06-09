import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { IngestSourceHandler } from './ingest-source.handler';
import { IngestSourceCommand } from './ingest-source.command';
import type { IngestionPipeline } from '@delve/core';
import type { Database } from '../../database/connection';
import type { EventBus } from '@nestjs/cqrs';
import type { ChunkIndexingService } from '../../indexing/services/chunk-indexing.service';
import type { WikiLinkIndexingService } from '../../indexing/services/wiki-link-indexing.service';

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

function makeChunkIndexing(override?: Partial<ChunkIndexingService>): ChunkIndexingService {
  return {
    embedAndStoreChunks: vi.fn().mockResolvedValue({ ok: true, value: 1 }),
    ...override,
  } as unknown as ChunkIndexingService;
}

function makeWikiLinkIndexing(): WikiLinkIndexingService {
  return {
    storeAndResolveOutgoingLinks: vi.fn().mockResolvedValue(undefined),
    backfillIncomingLinks: vi.fn().mockResolvedValue(undefined),
  } as unknown as WikiLinkIndexingService;
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
  let chunkIndexing: ChunkIndexingService;
  let wikiLinkIndexing: WikiLinkIndexingService;
  let eventBus: EventBus;

  function buildHandler(): IngestSourceHandler {
    return new IngestSourceHandler(db, pipeline, chunkIndexing, wikiLinkIndexing, eventBus);
  }

  beforeEach(() => {
    db = makeDb();
    pipeline = makeIngestionPipeline();
    chunkIndexing = makeChunkIndexing();
    wikiLinkIndexing = makeWikiLinkIndexing();
    eventBus = { publish: vi.fn() } as unknown as EventBus;
    handler = buildHandler();
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
    handler = buildHandler();

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

  it('returns err result and marks the source errored when chunk indexing fails', async () => {
    chunkIndexing = makeChunkIndexing({
      embedAndStoreChunks: vi
        .fn()
        .mockResolvedValue({ ok: false, error: 'Embedding failed: model unavailable' }),
    });
    handler = buildHandler();

    const command = new IngestSourceCommand(makeBuffer(), 'test.txt', 'text/plain', 11);

    const result = await handler.execute(command);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Embedding failed');
    }
    expect(db.update).toHaveBeenCalled();
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
    handler = buildHandler();

    const command = new IngestSourceCommand(makeBuffer(), 'test.txt', 'text/plain', 11);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
  });

  it('backfills incoming backlinks for markdown files even with no outgoing links', async () => {
    const command = new IngestSourceCommand(
      makeBuffer('plain markdown, no links'),
      'Target Note.md',
      'text/markdown',
      24,
      'coll-1',
    );

    const result = await handler.execute(command);

    expect(result.ok).toBe(true);
    expect(wikiLinkIndexing.backfillIncomingLinks).toHaveBeenCalledWith(
      'source-uuid-1',
      'coll-1',
      'Target Note',
    );
  });

  it('stores and resolves outgoing links for markdown files with wiki-links', async () => {
    const command = new IngestSourceCommand(
      makeBuffer('see [[Other Note]]'),
      'My Note.md',
      'text/markdown',
      18,
      'coll-1',
    );

    await handler.execute(command);

    expect(wikiLinkIndexing.storeAndResolveOutgoingLinks).toHaveBeenCalledWith(
      'source-uuid-1',
      'coll-1',
      expect.arrayContaining([
        expect.objectContaining({ targetFilename: 'Other Note' }),
      ]),
    );
  });

  it('does not touch wiki-link indexing for non-markdown files', async () => {
    const command = new IngestSourceCommand(makeBuffer(), 'test.txt', 'text/plain', 11);

    await handler.execute(command);

    expect(wikiLinkIndexing.storeAndResolveOutgoingLinks).not.toHaveBeenCalled();
    expect(wikiLinkIndexing.backfillIncomingLinks).not.toHaveBeenCalled();
  });
});
