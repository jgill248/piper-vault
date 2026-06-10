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

const GENERATED_OUTCOME = { status: 'generated', pagesCreated: 1, pagesSynthesized: 0 };

function makeCommandBus(): CommandBus {
  return {
    execute: vi.fn().mockResolvedValue(GENERATED_OUTCOME),
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
        // Second call chains .orderBy() for chronological ordering
        const result = Promise.resolve(sourceRows);
        return Object.assign(result, { orderBy: vi.fn().mockResolvedValue(sourceRows) });
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

/** Waits for the background processing run to record its 'initialize' log entry. */
async function waitForCompletionLog(insertValues: ReturnType<typeof vi.fn>) {
  await vi.waitFor(() => {
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'initialize' }),
    );
  });
  const call = insertValues.mock.calls.find(
    (c) => (c[0] as { operation?: string }).operation === 'initialize',
  );
  return call?.[0] as {
    operation: string;
    summary: string;
    metadata: {
      totalEligible: number;
      sourcesProcessed: number;
      sourcesSkipped: number;
      errorCount: number;
      errors: string[];
    };
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

  it('returns a started summary immediately and processes in the background', async () => {
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
      expect(result.value.sourcesProcessed).toBe(0);
      expect(result.value.summary).toContain('started');
    }

    const log = await waitForCompletionLog(insertValues);
    expect(log.metadata.sourcesProcessed).toBe(3);
    expect(log.metadata.errorCount).toBe(0);
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(3);
  });

  it('skips already-processed sources', async () => {
    const wikiLogRows = [{ sourceTriggerIds: 'src-1' }];
    const sourceRows = [
      { id: 'src-1', filename: 'already.md' },
      { id: 'src-2', filename: 'new.txt' },
    ];
    const { db, insertValues } = makeDb(wikiLogRows, sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(1);
      expect(result.value.sourcesSkipped).toBe(1);
    }

    await waitForCompletionLog(insertValues);
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

  it('records thrown generation errors in the completion log', async () => {
    const sourceRows = [
      { id: 'src-1', filename: 'good.txt' },
      { id: 'src-2', filename: 'bad.txt' },
    ];
    const { db, insertValues } = makeDb([], sourceRows);
    const bus = {
      execute: vi.fn()
        .mockResolvedValueOnce(GENERATED_OUTCOME)
        .mockRejectedValueOnce(new Error('LLM timeout')),
    } as unknown as CommandBus;
    const handler = new InitializeWikiHandler(db, configStore, bus);

    const result = await handler.execute(new InitializeWikiCommand());
    expect(result.ok).toBe(true);

    const log = await waitForCompletionLog(insertValues);
    expect(log.metadata.sourcesProcessed).toBe(1);
    expect(log.metadata.errorCount).toBe(1);
    expect(log.metadata.errors[0]).toContain('bad.txt');
    expect(log.metadata.errors[0]).toContain('LLM timeout');
    expect(log.summary).toContain('1 failed');
  });

  it('counts failed generation outcomes as errors, not processed sources', async () => {
    const sourceRows = [
      { id: 'src-1', filename: 'good.txt' },
      { id: 'src-2', filename: 'unreachable.txt' },
    ];
    const { db, insertValues } = makeDb([], sourceRows);
    const bus = {
      execute: vi.fn()
        .mockResolvedValueOnce(GENERATED_OUTCOME)
        .mockResolvedValueOnce({
          status: 'failed',
          pagesCreated: 0,
          pagesSynthesized: 0,
          error: 'LLM query failed: connection refused',
        }),
    } as unknown as CommandBus;
    const handler = new InitializeWikiHandler(db, configStore, bus);

    const result = await handler.execute(new InitializeWikiCommand());
    expect(result.ok).toBe(true);

    const log = await waitForCompletionLog(insertValues);
    expect(log.metadata.sourcesProcessed).toBe(1);
    expect(log.metadata.errorCount).toBe(1);
    expect(log.metadata.errors[0]).toContain('unreachable.txt');
    expect(log.metadata.errors[0]).toContain('connection refused');
  });

  it('rejects a second initialization while one is in flight', async () => {
    const sourceRows = [{ id: 'src-1', filename: 'doc.txt' }];
    const { db, insertValues } = makeDb([], sourceRows);

    let releaseGeneration!: () => void;
    const pending = new Promise<typeof GENERATED_OUTCOME>((resolve) => {
      releaseGeneration = () => resolve(GENERATED_OUTCOME);
    });
    const bus = { execute: vi.fn().mockReturnValue(pending) } as unknown as CommandBus;
    const handler = new InitializeWikiHandler(db, configStore, bus);

    const first = await handler.execute(new InitializeWikiCommand());
    expect(first.ok).toBe(true);

    const second = await handler.execute(new InitializeWikiCommand());
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain('already running');
    }

    releaseGeneration();
    await waitForCompletionLog(insertValues);
  });

  it('passes force=true to GenerateWikiPagesCommand', async () => {
    const sourceRows = [{ id: 'src-1', filename: 'doc.txt' }];
    const { db, insertValues } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    await handler.execute(new InitializeWikiCommand());
    await waitForCompletionLog(insertValues);

    const cmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(cmd).toBeInstanceOf(GenerateWikiPagesCommand);
    expect(cmd.force).toBe(true);
  });

  it('uses provided collectionId instead of default', async () => {
    const sourceRows = [{ id: 'src-1', filename: 'doc.txt' }];
    const { db, insertValues } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    await handler.execute(new InitializeWikiCommand('custom-collection'));
    await waitForCompletionLog(insertValues);

    const cmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(cmd.collectionId).toBe('custom-collection');
  });

  it('includes user-created notes as eligible sources', async () => {
    // Notes (isNote=true) that are NOT generated should be eligible
    const sourceRows = [
      { id: 'src-1', filename: 'my-note.md' },
      { id: 'src-2', filename: 'another-note.md' },
    ];
    const { db, insertValues } = makeDb([], sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalEligible).toBe(2);
    }
    const log = await waitForCompletionLog(insertValues);
    expect(log.metadata.sourcesProcessed).toBe(2);
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
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
    const { db, insertValues } = makeDb(wikiLogRows, sourceRows);
    const handler = new InitializeWikiHandler(db, configStore, commandBus);

    const result: Result<InitializeWikiResult, string> = await handler.execute(
      new InitializeWikiCommand(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // src-1 skipped (in wikiLog), src-2 eligible, null entry ignored
      expect(result.value.totalEligible).toBe(1);
      expect(result.value.sourcesSkipped).toBe(1);
    }
    const log = await waitForCompletionLog(insertValues);
    expect(log.metadata.sourcesProcessed).toBe(1);
  });
});
