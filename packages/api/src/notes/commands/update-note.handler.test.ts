import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UpdateNoteHandler } from './update-note.handler';
import { UpdateNoteCommand } from './update-note.command';
import type { Database } from '../../database/connection';
import type { IngestionPipeline, Embedder } from '@delve/core';

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

function makeEmbedder() {
  return {
    embedBatch: vi.fn().mockResolvedValue({ ok: true, value: [[0.1]] }),
  } as unknown as Embedder;
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
    const handler = new UpdateNoteHandler(db, makePipeline(), makeEmbedder());

    await expect(
      handler.execute(new UpdateNoteCommand('missing-id', 'new content')),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates content, re-chunks, and re-embeds', async () => {
    const { db } = makeDb(NOTE);
    const pipeline = makePipeline();
    const embedder = makeEmbedder();
    const handler = new UpdateNoteHandler(db, pipeline, embedder);

    const result = await handler.execute(
      new UpdateNoteCommand('note-1', 'updated content [[Link]]'),
    );

    expect(result.ok).toBe(true);
    expect(pipeline.ingest).toHaveBeenCalled();
    expect(embedder.embedBatch).toHaveBeenCalled();
  });

  it('updates metadata fields without re-chunking when content is unchanged', async () => {
    const { db } = makeDb(NOTE);
    const pipeline = makePipeline();
    const embedder = makeEmbedder();
    const handler = new UpdateNoteHandler(db, pipeline, embedder);

    const result = await handler.execute(
      new UpdateNoteCommand('note-1', undefined, 'New Title', undefined, ['new-tag']),
    );

    expect(result.ok).toBe(true);
    expect(pipeline.ingest).not.toHaveBeenCalled();
    expect(embedder.embedBatch).not.toHaveBeenCalled();
  });
});
