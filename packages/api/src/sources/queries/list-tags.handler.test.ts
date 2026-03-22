import { describe, it, expect, vi } from 'vitest';
import { ListTagsHandler } from './list-tags.handler';
import { ListTagsQuery } from './list-tags.query';
import type { Database } from '../../database/connection';

function makeDb(rows: Array<{ tag: string }>): Database {
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

  it('returns sorted unique tags', async () => {
    const handler = new ListTagsHandler(
      makeDb([{ tag: 'alpha' }, { tag: 'beta' }, { tag: 'gamma' }]),
    );
    const result = await handler.execute(new ListTagsQuery());
    expect(result).toEqual(['alpha', 'beta', 'gamma']);
  });
});
