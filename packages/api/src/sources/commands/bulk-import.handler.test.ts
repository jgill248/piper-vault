import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import type { Stats } from 'node:fs';
import { BulkImportHandler } from './bulk-import.handler';
import { BulkImportCommand } from './bulk-import.command';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('test content')),
}));

// Mock @delve/core
vi.mock('@delve/core', () => ({
  walkDirectory: vi.fn(),
}));

import { existsSync, statSync } from 'node:fs';
import { walkDirectory } from '@delve/core';

function makeCommandBus(
  ingestResult: { ok: boolean; value?: { sourceId: string }; error?: string } = {
    ok: true,
    value: { sourceId: 'src-1' },
  },
) {
  return {
    execute: vi.fn().mockResolvedValue(ingestResult),
  } as unknown as CommandBus;
}

function mockStats(isDir: boolean): Stats {
  return { isDirectory: () => isDir } as unknown as Stats;
}

function mockFiles(...files: Array<{ path: string; filename: string; mimeType: string; fileSize: number }>) {
  return files as ReturnType<typeof walkDirectory>;
}

describe('BulkImportHandler', () => {
  it('throws BadRequestException when directory does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const handler = new BulkImportHandler(makeCommandBus());
    await expect(
      handler.execute(new BulkImportCommand('/missing/dir')),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when path is not a directory', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue(mockStats(false));

    const handler = new BulkImportHandler(makeCommandBus());
    await expect(
      handler.execute(new BulkImportCommand('/some/file.txt')),
    ).rejects.toThrow(BadRequestException);
  });

  it('ingests all files and returns stats', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue(mockStats(true));
    vi.mocked(walkDirectory).mockReturnValue(mockFiles(
      { path: '/dir/a.txt', filename: 'a.txt', mimeType: 'text/plain', fileSize: 100 },
      { path: '/dir/b.md', filename: 'b.md', mimeType: 'text/markdown', fileSize: 200 },
    ));

    const bus = makeCommandBus();
    const handler = new BulkImportHandler(bus);
    const result = await handler.execute(new BulkImportCommand('/dir'));

    expect(result.filesFound).toBe(2);
    expect(result.filesIngested).toBe(2);
    expect(result.filesSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips files exceeding MAX_FILE_SIZE', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue(mockStats(true));
    vi.mocked(walkDirectory).mockReturnValue(mockFiles(
      { path: '/dir/huge.bin', filename: 'huge.bin', mimeType: 'application/octet-stream', fileSize: 600 * 1024 * 1024 },
    ));

    const handler = new BulkImportHandler(makeCommandBus());
    const result = await handler.execute(new BulkImportCommand('/dir'));

    expect(result.filesSkipped).toBe(1);
    expect(result.errors[0]).toContain('exceeds max file size');
  });

  it('handles ingestion failure gracefully', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue(mockStats(true));
    vi.mocked(walkDirectory).mockReturnValue(mockFiles(
      { path: '/dir/bad.txt', filename: 'bad.txt', mimeType: 'text/plain', fileSize: 100 },
    ));

    const bus = makeCommandBus({ ok: false, error: 'duplicate' });
    const handler = new BulkImportHandler(bus);
    const result = await handler.execute(new BulkImportCommand('/dir'));

    expect(result.filesIngested).toBe(0);
    expect(result.filesSkipped).toBe(1);
    expect(result.errors[0]).toContain('duplicate');
  });

  it('applies tags to ingested files', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue(mockStats(true));
    vi.mocked(walkDirectory).mockReturnValue(mockFiles(
      { path: '/dir/a.txt', filename: 'a.txt', mimeType: 'text/plain', fileSize: 100 },
    ));

    const bus = makeCommandBus();
    const handler = new BulkImportHandler(bus);
    await handler.execute(new BulkImportCommand('/dir', ['tag1', 'tag2']));

    // IngestSourceCommand + UpdateSourceTagsCommand = 2 calls
    expect((bus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it('returns empty results for empty directory', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue(mockStats(true));
    vi.mocked(walkDirectory).mockReturnValue([]);

    const handler = new BulkImportHandler(makeCommandBus());
    const result = await handler.execute(new BulkImportCommand('/dir'));

    expect(result.filesFound).toBe(0);
    expect(result.filesIngested).toBe(0);
  });
});
