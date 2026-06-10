import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WikiLinkIndexingService, resolveByPreference } from './wiki-link-indexing.service';
import type { ParsedWikiLink } from '@delve/core';
import type { Database } from '../../database/connection';

function makeLink(target: string): ParsedWikiLink {
  return {
    targetFilename: target,
    displayText: null,
    section: null,
    linkType: 'wiki-link',
    position: { start: 0, end: target.length + 4 },
  };
}

interface DbMocks {
  db: Database;
  insertValues: ReturnType<typeof vi.fn>;
  selectWhere: ReturnType<typeof vi.fn>;
  updateWhere: ReturnType<typeof vi.fn>;
  updateSet: ReturnType<typeof vi.fn>;
}

const BASE_DATE = new Date('2024-01-01T00:00:00Z');

function makeSourceRow(
  id: string,
  filename: string,
  isGenerated = false,
  updatedAt: Date = BASE_DATE,
) {
  return { id, filename, isGenerated, updatedAt };
}

function makeDb(selectRows: unknown[] = []): DbMocks {
  const insertValues = vi.fn().mockResolvedValue([]);
  const selectWhere = vi.fn().mockResolvedValue(selectRows);
  const updateWhere = vi.fn().mockResolvedValue([]);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const db = {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: selectWhere }),
    }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
  } as unknown as Database;
  return { db, insertValues, selectWhere, updateWhere, updateSet };
}

// ---------------------------------------------------------------------------
// Unit tests for the pure resolveByPreference helper
// ---------------------------------------------------------------------------

describe('resolveByPreference', () => {
  it('returns undefined for an empty array', () => {
    expect(resolveByPreference([])).toBeUndefined();
  });

  it('returns the only row when there is a single candidate', () => {
    expect(
      resolveByPreference([{ id: 'a', isGenerated: false, updatedAt: BASE_DATE }]),
    ).toBe('a');
  });

  it('prefers user-authored (isGenerated=false) over generated (isGenerated=true)', () => {
    const rows = [
      { id: 'wiki-copy', isGenerated: true, updatedAt: new Date('2024-06-01') },
      { id: 'user-note', isGenerated: false, updatedAt: new Date('2024-01-01') },
    ];
    expect(resolveByPreference(rows)).toBe('user-note');
  });

  it('among two user-authored notes, prefers the most recently updated', () => {
    const rows = [
      { id: 'older', isGenerated: false, updatedAt: new Date('2024-01-01') },
      { id: 'newer', isGenerated: false, updatedAt: new Date('2024-06-01') },
    ];
    expect(resolveByPreference(rows)).toBe('newer');
  });

  it('among two generated notes, prefers the most recently updated', () => {
    const rows = [
      { id: 'gen-old', isGenerated: true, updatedAt: new Date('2024-01-01') },
      { id: 'gen-new', isGenerated: true, updatedAt: new Date('2024-06-01') },
    ];
    expect(resolveByPreference(rows)).toBe('gen-new');
  });

  it('user-authored beats generated even when generated is more recently updated', () => {
    const rows = [
      { id: 'wiki-copy', isGenerated: true, updatedAt: new Date('2024-12-31') },
      { id: 'user-note', isGenerated: false, updatedAt: new Date('2024-01-01') },
    ];
    expect(resolveByPreference(rows)).toBe('user-note');
  });
});

// ---------------------------------------------------------------------------
// Integration-style tests for the service
// ---------------------------------------------------------------------------

describe('WikiLinkIndexingService', () => {
  describe('storeAndResolveOutgoingLinks', () => {
    let mocks: DbMocks;

    beforeEach(() => {
      mocks = makeDb([
        makeSourceRow('target-a', 'Note A.md'),
        makeSourceRow('target-b', 'Note B.md'),
      ]);
    });

    it('inserts link rows and resolves targets with a single SELECT', async () => {
      const service = new WikiLinkIndexingService(mocks.db);

      await service.storeAndResolveOutgoingLinks('source-1', 'coll-1', [
        makeLink('Note A'),
        makeLink('Note B'),
        makeLink('Missing Note'),
      ]);

      expect(mocks.insertValues).toHaveBeenCalledTimes(1);
      const rows = mocks.insertValues.mock.calls[0]![0] as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ sourceId: 'source-1', targetFilename: 'Note A' });

      // One batched SELECT for all targets, not one per link
      expect(mocks.db.select).toHaveBeenCalledTimes(1);
      // One UPDATE per resolved target; unresolved targets are skipped
      expect(mocks.updateSet).toHaveBeenCalledTimes(2);
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'target-a' });
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'target-b' });
    });

    it('deduplicates repeated link targets before resolving', async () => {
      const service = new WikiLinkIndexingService(mocks.db);

      await service.storeAndResolveOutgoingLinks('source-1', 'coll-1', [
        makeLink('Note A'),
        makeLink('Note A'),
      ]);

      // Both rows inserted, but only one resolution UPDATE
      const rows = mocks.insertValues.mock.calls[0]![0] as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(mocks.updateSet).toHaveBeenCalledTimes(1);
    });

    it('does nothing for an empty link list', async () => {
      const service = new WikiLinkIndexingService(mocks.db);

      await service.storeAndResolveOutgoingLinks('source-1', 'coll-1', []);

      expect(mocks.db.insert).not.toHaveBeenCalled();
      expect(mocks.db.select).not.toHaveBeenCalled();
    });

    it('swallows storage failures without throwing', async () => {
      mocks.insertValues.mockRejectedValue(new Error('insert failed'));
      const service = new WikiLinkIndexingService(mocks.db);

      await expect(
        service.storeAndResolveOutgoingLinks('source-1', 'coll-1', [makeLink('Note A')]),
      ).resolves.toBeUndefined();
    });

    it('resolves targets case-insensitively', async () => {
      const service = new WikiLinkIndexingService(mocks.db);

      await service.storeAndResolveOutgoingLinks('source-1', 'coll-1', [
        makeLink('note a'),
        makeLink('NOTE B'),
      ]);

      expect(mocks.updateSet).toHaveBeenCalledTimes(2);
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'target-a' });
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'target-b' });
    });

    it('prefers an exact-case match when sources differ only by case', async () => {
      mocks = makeDb([
        makeSourceRow('lower-note', 'note a.md'),
        makeSourceRow('upper-note', 'Note A.md'),
      ]);
      const service = new WikiLinkIndexingService(mocks.db);

      await service.storeAndResolveOutgoingLinks('source-1', 'coll-1', [makeLink('Note A')]);

      expect(mocks.updateSet).toHaveBeenCalledTimes(1);
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'upper-note' });
    });

    it('resolves to the user-authored note when a wiki-generated copy shares the title', async () => {
      // Both rows share the same filename (title collision)
      mocks = makeDb([
        makeSourceRow('wiki-copy', 'My Topic.md', true, new Date('2024-06-01')),
        makeSourceRow('user-note', 'My Topic.md', false, new Date('2024-01-01')),
      ]);
      const service = new WikiLinkIndexingService(mocks.db);

      await service.storeAndResolveOutgoingLinks('source-1', 'coll-1', [makeLink('My Topic')]);

      expect(mocks.updateSet).toHaveBeenCalledTimes(1);
      // The user-authored note must win even though the wiki copy is newer
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'user-note' });
    });
  });

  describe('backfillIncomingLinks', () => {
    it('updates unresolved links scoped to the collection', async () => {
      const mocks = makeDb([{ id: 'sibling-1' }, { id: 'sibling-2' }]);
      const service = new WikiLinkIndexingService(mocks.db);

      await service.backfillIncomingLinks('source-1', 'coll-1', 'My Note');

      // Collection sources are looked up first, then a single scoped UPDATE
      expect(mocks.db.select).toHaveBeenCalledTimes(1);
      expect(mocks.updateSet).toHaveBeenCalledTimes(1);
      expect(mocks.updateSet).toHaveBeenCalledWith({ targetSourceId: 'source-1' });
      expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
    });

    it('skips the update when the collection has no sources', async () => {
      const mocks = makeDb([]);
      const service = new WikiLinkIndexingService(mocks.db);

      await service.backfillIncomingLinks('source-1', 'coll-1', 'My Note');

      expect(mocks.db.update).not.toHaveBeenCalled();
    });

    it('swallows failures without throwing', async () => {
      const mocks = makeDb();
      mocks.selectWhere.mockRejectedValue(new Error('db down'));
      const service = new WikiLinkIndexingService(mocks.db);

      await expect(
        service.backfillIncomingLinks('source-1', 'coll-1', 'My Note'),
      ).resolves.toBeUndefined();
    });
  });
});
