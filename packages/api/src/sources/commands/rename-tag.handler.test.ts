import { describe, it, expect, vi } from 'vitest';
import { RenameTagHandler } from './rename-tag.handler';
import { RenameTagCommand } from './rename-tag.command';
import type { Database } from '../../database/connection';

function makeDb(affectedRows: Array<{ id: string }> = []): Database {
  return {
    execute: vi.fn().mockResolvedValue(affectedRows),
  } as unknown as Database;
}

describe('RenameTagHandler', () => {
  it('renames a tag and returns the affected count', async () => {
    const db = makeDb([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const handler = new RenameTagHandler(db);

    const result = await handler.execute(new RenameTagCommand('ml', 'machine-learning'));

    expect(result).toEqual({ ok: true, value: { affectedCount: 3 } });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('returns zero when no sources carry the tag', async () => {
    const handler = new RenameTagHandler(makeDb([]));

    const result = await handler.execute(new RenameTagCommand('missing', 'other'));

    expect(result).toEqual({ ok: true, value: { affectedCount: 0 } });
  });

  it('rejects identical old and new tags', async () => {
    const db = makeDb();
    const handler = new RenameTagHandler(db);

    const result = await handler.execute(new RenameTagCommand('same', ' same '));

    expect(result.ok).toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('rejects empty tags', async () => {
    const db = makeDb();
    const handler = new RenameTagHandler(db);

    const result = await handler.execute(new RenameTagCommand('  ', 'new'));

    expect(result.ok).toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
