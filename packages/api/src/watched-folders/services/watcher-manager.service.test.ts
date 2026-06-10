import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandBus } from '@nestjs/cqrs';
import type { Database } from '../../database/connection';
import type { WatchedFolderRow } from '../../database/schema';
import { WatcherManagerService } from './watcher-manager.service';

interface CapturedCallbacks {
  onAdd: (filePath: string) => void;
  onChange: (filePath: string) => void;
  onUnlink: (filePath: string) => void;
  onError: (error: Error) => void;
}

const captured: { callbacks: CapturedCallbacks | null } = { callbacks: null };

vi.mock('@delve/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@delve/core')>();
  return {
    ...original,
    FileWatcher: vi.fn().mockImplementation((_path: string, callbacks: CapturedCallbacks) => {
      captured.callbacks = callbacks;
      return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return { ...original, existsSync: vi.fn().mockReturnValue(true) };
});

function makeFolder(): WatchedFolderRow {
  return {
    id: 'folder-1',
    folderPath: '/watched',
    recursive: false,
    collectionId: 'coll-1',
    enabled: true,
  } as unknown as WatchedFolderRow;
}

describe('WatcherManagerService', () => {
  let db: Database;
  let commandBus: CommandBus;
  let service: WatcherManagerService;

  beforeEach(() => {
    captured.callbacks = null;
    db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('db down')),
          }),
        }),
      }),
    } as unknown as Database;
    commandBus = { execute: vi.fn().mockResolvedValue({ ok: true, value: {} }) } as unknown as CommandBus;
    service = new WatcherManagerService(db, commandBus);
  });

  it('logs rejected unlink handlers instead of leaving an unhandled rejection', async () => {
    const errorSpy = vi
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await service.startWatching(makeFolder());
    expect(captured.callbacks).not.toBeNull();

    // handleFileRemoved's DB lookup rejects ('db down'); the callback must
    // swallow and log it rather than produce an unhandled rejection.
    captured.callbacks!.onUnlink('/watched/gone.md');
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('gone.md'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
