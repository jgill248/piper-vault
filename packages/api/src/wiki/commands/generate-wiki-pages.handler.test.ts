import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandBus } from '@nestjs/cqrs';
import type { LlmProvider } from '@delve/core';
import { GenerateWikiPagesHandler } from './generate-wiki-pages.handler';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import type { Database } from '../../database/connection';
import type { ConfigStore } from '../../config/config.store';
import { DEFAULT_CONFIG } from '@delve/shared';

// Mock generateWikiPages from @delve/core
vi.mock('@delve/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@delve/core')>();
  return {
    ...actual,
    generateWikiPages: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        pages: [{ title: 'Test Page', content: 'Content', tags: ['topic'] }],
        updatedPages: [],
        summary: 'Generated 1 page',
      },
    }),
  };
});

import { generateWikiPages } from '@delve/core';

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

function makeConfigStore(overrides: Record<string, unknown> = {}): ConfigStore {
  return {
    get: vi.fn().mockReturnValue({ ...DEFAULT_CONFIG, wikiEnabled: true, wikiAutoIngest: true, ...overrides }),
    update: vi.fn(),
  } as unknown as ConfigStore;
}

function makeCommandBus(): CommandBus {
  return {
    execute: vi.fn().mockResolvedValue({ ok: true, value: { sourceId: 'note-1', chunkCount: 1 } }),
  } as unknown as CommandBus;
}

function makeLlm(): LlmProvider {
  return {
    query: vi.fn(),
    streamQuery: vi.fn(),
    getModels: vi.fn(),
  } as unknown as LlmProvider;
}

function makeDb(
  sourceRow: { filename: string; content: string | null } | null = { filename: 'test.md', content: 'Test content' },
  existingPages: Array<{ id: string; title: string | null; content: string | null }> = [],
) {
  let selectCallCount = 0;

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First select: load source row
          return { limit: vi.fn().mockResolvedValue(sourceRow ? [sourceRow] : []) };
        }
        // Second select: existing wiki pages
        return Promise.resolve(existingPages);
      }),
    })),
  }));

  const insertValues = vi.fn().mockResolvedValue([]);
  const insertFn = vi.fn().mockReturnValue({ values: insertValues });
  const updateFn = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  });

  return {
    db: { select: selectFn, insert: insertFn, update: updateFn } as unknown as Database,
    selectFn,
    insertFn,
    insertValues,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenerateWikiPagesHandler', () => {
  let llm: LlmProvider;
  let commandBus: CommandBus;

  beforeEach(() => {
    vi.clearAllMocks();
    llm = makeLlm();
    commandBus = makeCommandBus();
  });

  it('skips when wikiEnabled is false', async () => {
    const configStore = makeConfigStore({ wikiEnabled: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1'));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('skips when wikiAutoIngest is false and force is false', async () => {
    const configStore = makeConfigStore({ wikiAutoIngest: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', false));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('proceeds when wikiAutoIngest is false but force is true', async () => {
    const configStore = makeConfigStore({ wikiAutoIngest: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', true));

    expect(generateWikiPages).toHaveBeenCalled();
  });

  it('still skips when wikiEnabled is false even with force=true', async () => {
    const configStore = makeConfigStore({ wikiEnabled: false, wikiAutoIngest: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', true));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('proceeds normally when both wikiEnabled and wikiAutoIngest are true', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1'));

    expect(generateWikiPages).toHaveBeenCalled();
  });

  it('creates notes via CommandBus for generated pages', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1'));

    // Should dispatch CreateNoteCommand for the generated page
    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('skips silently when source is not found', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb(null);
    const handler = new GenerateWikiPagesHandler(db, llm, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('missing-src', 'col-1'));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('default force is false', () => {
    const cmd = new GenerateWikiPagesCommand('src-1', 'col-1');
    expect(cmd.force).toBe(false);
  });

  it('force can be set to true', () => {
    const cmd = new GenerateWikiPagesCommand('src-1', 'col-1', true);
    expect(cmd.force).toBe(true);
  });
});
