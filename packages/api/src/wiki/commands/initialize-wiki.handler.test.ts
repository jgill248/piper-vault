import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandBus } from '@nestjs/cqrs';
import { InitializeWikiHandler } from './initialize-wiki.handler';
import type { InitializeWikiResult } from './initialize-wiki.handler';
import { InitializeWikiCommand } from './initialize-wiki.command';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import type { Database } from '../../database/connection';
import type { ConfigStore } from '../../config/config.store';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

function makeConfigStore(overrides: Record<string, unknown> = {}): ConfigStore {
  return {
    get: vi.fn().mockReturnValue({ ...DEFAULT_CONFIG, ...overrides }),
    update: vi.fn(),
  } as unknown as ConfigStore;
}

function makeCommandBus(): CommandBus {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as CommandBus;
}

/**
 * Builds a mock Database where:
 * - First select().from().where() call returns `wikiLogRows` (the wikiLog query)
 * - Second select().from().where() call returns `sourceRows` (the sources query)
 * - insert().values() resolves (for the wikiLog insert at end)
 */
function makeDb(
  wikiLogRows: Array<{ sourceTriggerIds: string | null }> = [],
  sourceRows: Array<{ id: string; filename: string }> = [],
) {
  let selectCallCount = 0;

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return Promise.resolve(wikiLogRows);
        return Promise.resolve(sourceRows);
      }),
    })),
  }));

  const insertValues = vi.fn().mockResolvedValue([]);
  const insertFn = vi.fn().mockReturnValue({ values: insertValues });

  return {
    db: { select: selectFn, insert: insertFn } as unknown as Database,
    selectFn,
    insertFn,
    insertValues,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InitializeWikiHandler', () => {
  let configStore: ConfigStore;
  let commandBus: CommandBus;

  beforeEach(() => {
    configStore = makeConfigStore({ wikiEnabled: true });
    commandBus = makeCommandBus();
  });

  it('returns error when wiki is disabled', async () => {
    const disabledConfig = makeConfigStore({ wikiEnabled: false });
    const { db } = makeDb();
    const handler = new InitializeWikiHandler(db, disabledConfig, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Wiki is not enabled');
    }
  });

  it('returns empty result when no sources exist', async () => {
    const { db } = makeDb([], []);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(0);
      expect(result.value.sourcesProcessed).toBe(0);
      expect(result.value.sourcesSkipped).toBe(0);
      expect(result.value.summary).toContain('No sources found');
    }
  });

  it('skips already-processed sources', async () => {
    const wikiLogRows = [{ sourceTriggerIds: 'src-1' }];
    const sourceRows = [
      { id: 'src-1', filename: 'already.md' },
      { id: 'src-2', filename: 'new.txt' },
    ];
    const { db } = makeDb(wikiLogRows, sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(1);
      expect(result.value.sourcesProcessed).toBe(1);
      expect(result.value.sourcesSkipped).toBe(1);
    }
    // Only dispatched for src-2, not src-1
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    const dispatchedCmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(dispatchedCmd).toBeInstanceOf(GenerateWikiPagesCommand);
    expect(dispatchedCmd.sourceId).toBe('src-2');
    expect(dispatchedCmd.force).toBe(true);
  });

  it('reports all processed when all sources are already done', async () => {
    const wikiLogRows = [{ sourceTriggerIds: 'src-1' }];
    const sourceRows = [{ id: 'src-1', filename: 'done.md' }];
    const { db } = makeDb(wikiLogRows, sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(0);
      expect(result.value.sourcesSkipped).toBe(1);
      expect(result.value.summary).toContain('already been processed');
    }
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('processes multiple eligible sources and returns counts', async () => {
    const sourceRows = [
      { id: 'src-1', filename: 'doc1.txt' },
      { id: 'src-2', filename: 'doc2.md' },
      { id: 'src-3', filename: 'doc3.pdf' },
    ];
    const { db, insertValues } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(3);
      expect(result.value.sourcesProcessed).toBe(3);
      expect(result.value.sourcesSkipped).toBe(0);
      expect(result.value.errors).toHaveLength(0);
    }
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(3);
    // Verify wikiLog insert was called
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'initialize' }),
    );
  });

  it('handles generation failures gracefully and reports errors', async () => {
    const sourceRows = [
      { id: 'src-1', filename: 'good.txt' },
      { id: 'src-2', filename: 'bad.txt' },
    ];
    const { db } = makeDb([], sourceRows);
    const bus = {
      execute: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('LLM timeout')),
    } as unknown as CommandBus;
    const handler = new InitializeWikiHandler(db, configStore, bus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourcesProcessed).toBe(1);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toContain('bad.txt');
      expect(result.value.errors[0]).toContain('LLM timeout');
    }
  });

  it('passes force=true to GenerateWikiPagesCommand', async () => {
    const sourceRows = [{ id: 'src-1', filename: 'doc.txt' }];
    const { db } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    await handler.execute(new InitializeWikiCommand());

    const cmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(cmd).toBeInstanceOf(GenerateWikiPagesCommand);
    expect(cmd.force).toBe(true);
  });

  it('uses provided collectionId instead of default', async () => {
    const sourceRows = [{ id: 'src-1', filename: 'doc.txt' }];
    const { db } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    await handler.execute(new InitializeWikiCommand('custom-collection'));

    const cmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(cmd.collectionId).toBe('custom-collection');
  });

  it('includes user-created notes as eligible sources', async () => {
    // Notes (isNote=true) that are NOT generated should be eligible
    const sourceRows = [
      { id: 'src-1', filename: 'my-note.md' },
      { id: 'src-2', filename: 'another-note.md' },
    ];
    const { db } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(2);
      expect(result.value.sourcesProcessed).toBe(2);
    }
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it('excludes wiki-generated notes from initialization', async () => {
    // The DB query filters isGenerated=false, so generated notes won't appear
    // in sourceRows. Simulate: only non-generated sources returned by the query.
    const sourceRows = [
      { id: 'src-1', filename: 'user-doc.txt' },
    ];
    const { db } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Only the non-generated source is processed
      expect(result.value.totalEligible).toBe(1);
      expect(result.value.sourcesProcessed).toBe(1);
    }
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('filters null sourceTriggerIds from wikiLog', async () => {
    const wikiLogRows = [
      { sourceTriggerIds: 'src-1' },
      { sourceTriggerIds: null },
    ];
    const sourceRows = [
      { id: 'src-1', filename: 'done.md' },
      { id: 'src-2', filename: 'new.txt' },
    ];
    const { db } = makeDb(wikiLogRows, sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // src-1 skipped (in wikiLog), src-2 processed, null entry ignored
      expect(result.value.totalEligible).toBe(1);
      expect(result.value.sourcesProcessed).toBe(1);
      expect(result.value.sourcesSkipped).toBe(1);
    }
  });
});
