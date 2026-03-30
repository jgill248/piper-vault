import { describe, it, expect, vi } from 'vitest';
import { CreateNoteHandler } from './create-note.handler';
import { CreateNoteCommand } from './create-note.command';
import type { Database } from '../../database/connection';
import type { IngestionPipeline, Embedder } from '@delve/core';

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

function makeEmbedder(embeddings = [[0.1, 0.2, 0.3]]) {
  return {
    embedBatch: vi.fn().mockResolvedValue({ ok: true, value: embeddings }),
  } as unknown as Embedder;
}

describe('CreateNoteHandler', () => {
  it('creates a note and returns sourceId and chunkCount', async () => {
    const { db } = makeDb();
    const pipeline = makePipeline();
    const embedder = makeEmbedder();
    const handler = new CreateNoteHandler(db, pipeline, embedder);

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
    const embedder = makeEmbedder();
    const handler = new CreateNoteHandler(db, pipeline, embedder);

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
    const embedder = makeEmbedder();
    const handler = new CreateNoteHandler(db, pipeline, embedder);

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
    const embedder = {
      embedBatch: vi.fn().mockResolvedValue({ ok: false, error: 'Embed error' }),
    } as unknown as Embedder;
    const handler = new CreateNoteHandler(db, pipeline, embedder);

    const result = await handler.execute(
      new CreateNoteCommand('Note', 'content', 'col-1'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Embedding failed');
    }
  });
});
