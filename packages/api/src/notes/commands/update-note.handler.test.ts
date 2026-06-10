import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { EventBus } from '@nestjs/cqrs';
import { UpdateNoteHandler } from './update-note.handler';
import { UpdateNoteCommand } from './update-note.command';
import type { Database } from '../../database/connection';
import type { IngestionPipeline } from '@delve/core';
import type { ChunkIndexingService } from '../../indexing/services/chunk-indexing.service';
import type { WikiLinkIndexingService } from '../../indexing/services/wiki-link-indexing.service';

function makeEventBus(): EventBus {
  return { publish: vi.fn() } as unknown as EventBus;
}

function makeDb(existingNote: Record<string, unknown> | null = null) {
  const deleteFn = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
  const insertValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([]),
  });
  const insertFn = vi.fn().mockReturnValue({ values: insertValues });
  const updateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
  const updateFn = vi.fn().mockReturnValue({ set: updateSet });

  const selectFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(existingNote ? [existingNote] : []),
    }),
  });
  const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      select: selectFn,
      delete: deleteFn,
    } as unknown as Database,
    updateSet,
  };
}

function makePipeline() {
  return {
    ingest: vi.fn().mockResolvedValue({
      ok: true,
      value: { chunks: [{ index: 0, content: 'chunk', tokenCount: 5, metadata: {} }], contentHash: 'h', metadata: {} },
    }),
  } as unknown as IngestionPipeline;
}

function makeChunkIndexing(): ChunkIndexingService {
  return {
    embedAndStoreChunks: vi.fn().mockResolvedValue({ ok: true, value: 1 }),
  } as unknown as ChunkIndexingService;
}

function makeWikiLinkIndexing(): WikiLinkIndexingService {
  return {
    storeAndResolveOutgoingLinks: vi.fn().mockResolvedValue(undefined),
    backfillIncomingLinks: vi.fn().mockResolvedValue(undefined),
  } as unknown as WikiLinkIndexingService;
}

const NOTE = {
  id: 'note-1',
  filename: 'Test.md',
  isNote: true,
  collectionId: 'col-1',
  tags: ['old-tag'],
  content: 'old content',
};

describe('UpdateNoteHandler', () => {
  it('throws NotFoundException when note does not exist', async () => {
    const { db } = makeDb(null);
    const handler = new UpdateNoteHandler(
      db,
      makePipeline(),
      makeChunkIndexing(),
      makeWikiLinkIndexing(),
      makeEventBus(),
    );

    await expect(
      handler.execute(new UpdateNoteCommand('missing-id', 'new content')),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates content, re-chunks, and re-embeds', async () => {
    const { db } = makeDb(NOTE);
    const pipeline = makePipeline();
    const chunkIndexing = makeChunkIndexing();
    const wikiLinkIndexing = makeWikiLinkIndexing();
    const handler = new UpdateNoteHandler(db, pipeline, chunkIndexing, wikiLinkIndexing, makeEventBus());

    const result = await handler.execute(
      new UpdateNoteCommand('note-1', 'updated content [[Link]]'),
    );

    expect(result.ok).toBe(true);
    expect(pipeline.ingest).toHaveBeenCalled();
    expect(chunkIndexing.embedAndStoreChunks).toHaveBeenCalledWith(
      'note-1',
      expect.any(Array),
    );
    expect(wikiLinkIndexing.storeAndResolveOutgoingLinks).toHaveBeenCalledWith(
      'note-1',
      'col-1',
      expect.arrayContaining([expect.objectContaining({ targetFilename: 'Link' })]),
    );
  });

  it('updates metadata fields without re-chunking when content is unchanged', async () => {
    const { db } = makeDb(NOTE);
    const pipeline = makePipeline();
    const chunkIndexing = makeChunkIndexing();
    const handler = new UpdateNoteHandler(
      db,
      pipeline,
      chunkIndexing,
      makeWikiLinkIndexing(),
      makeEventBus(),
    );

    const result = await handler.execute(
      new UpdateNoteCommand('note-1', undefined, 'New Title', undefined, ['new-tag']),
    );

    expect(result.ok).toBe(true);
    expect(pipeline.ingest).not.toHaveBeenCalled();
    expect(chunkIndexing.embedAndStoreChunks).not.toHaveBeenCalled();
  });

  it('backfills incoming links against the new title on rename', async () => {
    const { db } = makeDb(NOTE);
    const wikiLinkIndexing = makeWikiLinkIndexing();
    const handler = new UpdateNoteHandler(
      db,
      makePipeline(),
      makeChunkIndexing(),
      wikiLinkIndexing,
      makeEventBus(),
    );

    await handler.execute(
      new UpdateNoteCommand('note-1', undefined, 'New Title'),
    );

    expect(wikiLinkIndexing.backfillIncomingLinks).toHaveBeenCalledWith(
      'note-1',
      'col-1',
      'New Title',
    );
  });
});
