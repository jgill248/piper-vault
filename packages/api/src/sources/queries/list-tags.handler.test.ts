import { describe, it, expect, vi } from 'vitest';
import { ListTagsHandler } from './list-tags.handler';
import { ListTagsQuery } from './list-tags.query';
import type { Database } from '../../database/connection';

function makeDb(rows: Array<{ tag: string; count: number }>): Database {
  return {
    execute: vi.fn().mockResolvedValue(rows),
  } as unknown as Database;
}

describe('ListTagsHandler', () => {
  it('returns empty array when no sources have tags', async () => {
    const handler = new ListTagsHandler(makeDb([]));
    const result = await handler.execute(new ListTagsQuery());
    expect(result).toEqual([]);
  });

  it('returns sorted tags with counts', async () => {
    const handler = new ListTagsHandler(
      makeDb([
        { tag: 'alpha', count: 3 },
        { tag: 'beta', count: 1 },
        { tag: 'gamma', count: 2 },
      ]),
    );
    const result = await handler.execute(new ListTagsQuery());
    expect(result).toEqual([
      { tag: 'alpha', count: 3 },
      { tag: 'beta', count: 1 },
      { tag: 'gamma', count: 2 },
    ]);
  });

  it('issues a single query when scoped to a collection', async () => {
    const db = makeDb([{ tag: 'alpha', count: 1 }]);
    const handler = new ListTagsHandler(db);
    const result = await handler.execute(new ListTagsQuery('coll-1'));
    expect(result).toEqual([{ tag: 'alpha', count: 1 }]);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
