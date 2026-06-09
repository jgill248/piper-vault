import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '@nestjs/cqrs';
import { CreateNoteHandler } from './create-note.handler';
import { CreateNoteCommand } from './create-note.command';
import type { Database } from '../../database/connection';
import type { IngestionPipeline } from '@delve/core';
import type { ChunkIndexingService } from '../../indexing/services/chunk-indexing.service';
import type { WikiLinkIndexingService } from '../../indexing/services/wiki-link-indexing.service';

function makeEventBus(): EventBus {
  return { publish: vi.fn() } as unknown as EventBus;
}

function makeDb() {
  const insertValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'note-1' }]),
  });
  const insertFn = vi.fn().mockReturnValue({ values: insertValues });
  const updateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
  const updateFn = vi.fn().mockReturnValue({ set: updateSet });
  const selectFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  });
  const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

  return {
    db: { insert: insertFn, update: updateFn, select: selectFn } as unknown as Database,
    insertFn,
    insertValues,
  };
}

function makePipeline(chunks = [{ index: 0, content: 'test chunk', tokenCount: 10, metadata: {} }]) {
  return {
    ingest: vi.fn().mockResolvedValue({
      ok: true,
      value: { chunks, contentHash: 'abc123', metadata: {} },
    }),
  } as unknown as IngestionPipeline;
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

describe('CreateNoteHandler', () => {
  it('creates a note and returns sourceId and chunkCount', async () => {
    const { db } = makeDb();
    const pipeline = makePipeline();
    const handler = new CreateNoteHandler(
      db,
      pipeline,
      makeChunkIndexing(),
      makeWikiLinkIndexing(),
      makeEventBus(),
    );

    const result = await handler.execute(
      new CreateNoteCommand('My Note', 'Hello [[World]]', 'col-1', null, ['test']),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceId).toBe('note-1');
      expect(result.value.chunkCount).toBe(1);
    }
  });

  it('extracts frontmatter tags and merges with provided tags', async () => {
    const { db, insertValues } = makeDb();
    const pipeline = makePipeline();
    const handler = new CreateNoteHandler(
      db,
      pipeline,
      makeChunkIndexing(),
      makeWikiLinkIndexing(),
      makeEventBus(),
    );

    await handler.execute(
      new CreateNoteCommand(
        '',
        '---\ntags: [fm-tag]\ntitle: FM Title\n---\nBody',
        'col-1',
        null,
        ['manual-tag'],
      ),
    );

    const insertedValues = insertValues.mock.calls[0]?.[0];
    expect(insertedValues).toBeDefined();
    // First insert call is the source record
    if (insertedValues) {
      expect(insertedValues.title).toBe('FM Title');
      expect(insertedValues.tags).toEqual(expect.arrayContaining(['manual-tag', 'fm-tag']));
      expect(insertedValues.isNote).toBe(true);
    }
  });

  it('returns error when ingestion pipeline fails', async () => {
    const { db } = makeDb();
    const pipeline = {
      ingest: vi.fn().mockResolvedValue({ ok: false, error: 'Parse error' }),
    } as unknown as IngestionPipeline;
    const handler = new CreateNoteHandler(
      db,
      pipeline,
      makeChunkIndexing(),
      makeWikiLinkIndexing(),
      makeEventBus(),
    );

    const result = await handler.execute(
      new CreateNoteCommand('Fail', 'content', 'col-1'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Parse error');
    }
  });

  it('returns error when embedding fails', async () => {
    const { db } = makeDb();
    const pipeline = makePipeline();
    const chunkIndexing = makeChunkIndexing({
      embedAndStoreChunks: vi
        .fn()
        .mockResolvedValue({ ok: false, error: 'Embedding failed: Embed error' }),
    });
    const handler = new CreateNoteHandler(
      db,
      pipeline,
      chunkIndexing,
      makeWikiLinkIndexing(),
      makeEventBus(),
    );

    const result = await handler.execute(
      new CreateNoteCommand('Note', 'content', 'col-1'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Embedding failed');
    }
  });

  it('stores outgoing links and backfills incoming links scoped to the collection', async () => {
    const { db } = makeDb();
    const pipeline = makePipeline();
    const wikiLinkIndexing = makeWikiLinkIndexing();
    const handler = new CreateNoteHandler(
      db,
      pipeline,
      makeChunkIndexing(),
      wikiLinkIndexing,
      makeEventBus(),
    );

    await handler.execute(
      new CreateNoteCommand('My Note', 'Hello [[World]]', 'col-1'),
    );

    expect(wikiLinkIndexing.storeAndResolveOutgoingLinks).toHaveBeenCalledWith(
      'note-1',
      'col-1',
      expect.arrayContaining([expect.objectContaining({ targetFilename: 'World' })]),
    );
    expect(wikiLinkIndexing.backfillIncomingLinks).toHaveBeenCalledWith(
      'note-1',
      'col-1',
      'My Note',
    );
  });
});
