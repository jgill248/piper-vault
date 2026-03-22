import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UpdateSourceTagsHandler } from './update-source-tags.handler';
import { UpdateSourceTagsCommand } from './update-source-tags.command';
import type { Database } from '../../database/connection';

function makeDb(sourceExists: boolean): Database {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            sourceExists ? [{ id: 'src-1' }] : [],
          ),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as unknown as Database;
}

describe('UpdateSourceTagsHandler', () => {
  it('throws NotFoundException when source does not exist', async () => {
    const handler = new UpdateSourceTagsHandler(makeDb(false));

    await expect(
      handler.execute(new UpdateSourceTagsCommand('missing', ['tag1'])),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates tags and returns them', async () => {
    const db = makeDb(true);
    const handler = new UpdateSourceTagsHandler(db);

    const result = await handler.execute(
      new UpdateSourceTagsCommand('src-1', ['tag1', 'tag2']),
    );

    expect(result).toEqual({ tags: ['tag1', 'tag2'] });
    expect(db.update).toHaveBeenCalled();
  });

  it('handles empty tags array', async () => {
    const handler = new UpdateSourceTagsHandler(makeDb(true));

    const result = await handler.execute(
      new UpdateSourceTagsCommand('src-1', []),
    );

    expect(result).toEqual({ tags: [] });
  });
});
