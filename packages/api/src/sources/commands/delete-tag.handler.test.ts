import { describe, it, expect, vi } from 'vitest';
import { DeleteTagHandler } from './delete-tag.handler';
import { DeleteTagCommand } from './delete-tag.command';
import type { Database } from '../../database/connection';

function makeDb(affectedRows: Array<{ id: string }> = []): Database {
  return {
    execute: vi.fn().mockResolvedValue(affectedRows),
  } as unknown as Database;
}

describe('DeleteTagHandler', () => {
  it('removes the tag and returns the affected count', async () => {
    const db = makeDb([{ id: 'a' }, { id: 'b' }]);
    const handler = new DeleteTagHandler(db);

    const result = await handler.execute(new DeleteTagCommand('obsolete'));

    expect(result).toEqual({ ok: true, value: { affectedCount: 2 } });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty tag', async () => {
    const db = makeDb();
    const handler = new DeleteTagHandler(db);

    const result = await handler.execute(new DeleteTagCommand('   '));

    expect(result.ok).toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
