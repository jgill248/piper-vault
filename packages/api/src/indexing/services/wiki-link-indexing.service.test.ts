import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WikiLinkIndexingService } from './wiki-link-indexing.service';
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

describe('WikiLinkIndexingService', () => {
  describe('storeAndResolveOutgoingLinks', () => {
    let mocks: DbMocks;

    beforeEach(() => {
      mocks = makeDb([
        { id: 'target-a', filename: 'Note A.md' },
        { id: 'target-b', filename: 'Note B.md' },
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
