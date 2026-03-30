import { describe, it, expect, vi } from 'vitest';
import { ListSourcesHandler } from './list-sources.handler';
import { ListSourcesQuery } from './list-sources.query';
import type { Database } from '../../database/connection';

function makeSourceRow(override: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-1',
    filename: 'notes.txt',
    fileType: 'text/plain',
    fileSize: 1024,
    contentHash: 'deadbeef',
    status: 'ready',
    chunkCount: 3,
    metadata: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...override,
  };
}

function makeDb(rows: ReturnType<typeof makeSourceRow>[], total = rows.length): Database {
  return {
    select: vi.fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ count: total }]),
      }),
  } as unknown as Database;
}

describe('ListSourcesHandler', () => {
  let handler: ListSourcesHandler;

  it('returns paginated sources', async () => {
    const rows = [makeSourceRow(), makeSourceRow({ id: 'uuid-2', filename: 'doc.md' })];
    const db = makeDb(rows, 2);
    handler = new ListSourcesHandler(db);

    const result = await handler.execute(new ListSourcesQuery(1, 20));

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.hasMore).toBe(false);
  });

  it('sets hasMore when more rows exist beyond the current page', async () => {
    const rows = [makeSourceRow()];
    const db = makeDb(rows, 5); // 5 total but only 1 returned (page 1, size 1)
    handler = new ListSourcesHandler(db);

    const result = await handler.execute(new ListSourcesQuery(1, 1));

    expect(result.hasMore).toBe(true);
  });

  it('maps DB rows to Source domain type', async () => {
    const row = makeSourceRow({ filename: 'report.pdf', fileType: 'application/pdf' });
    const db = makeDb([row]);
    handler = new ListSourcesHandler(db);

    const result = await handler.execute(new ListSourcesQuery(1, 20));

    expect(result.data[0]?.filename).toBe('report.pdf');
    expect(result.data[0]?.fileType).toBe('application/pdf');
    expect(result.data[0]?.status).toBe('ready');
  });
});
