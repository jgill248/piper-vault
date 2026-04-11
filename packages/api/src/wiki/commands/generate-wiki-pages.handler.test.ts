import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandBus } from '@nestjs/cqrs';
import type { LlmProvider, Embedder } from '@delve/core';
import { GenerateWikiPagesHandler } from './generate-wiki-pages.handler';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import type { Database } from '../../database/connection';
import type { ConfigStore } from '../../config/config.store';
import { DEFAULT_CONFIG } from '@delve/shared';

// Mock core functions
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
    synthesizeWikiPage: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: 'Synthesized content',
        mergedSourceIds: ['src-1', 'src-2'],
        summary: 'Merged new info',
        changeType: 'minor_update',
      },
    }),
    findSimilarPages: vi.fn().mockReturnValue([]),
    averageEmbeddings: vi.fn().mockReturnValue([0.1, 0.2, 0.3]),
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

function makeEmbedder(): Embedder {
  return {
    dimensions: 384,
    embed: vi.fn().mockResolvedValue({ ok: true, value: new Array(384).fill(0.1) }),
    embedBatch: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  } as unknown as Embedder;
}

function makeDb(
  sourceRow: { filename: string; content: string | null } | null = { filename: 'test.md', content: 'Test content' },
) {
  let selectCallCount = 0;

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // loadSourceContent: source content
          return { limit: vi.fn().mockResolvedValue(sourceRow ? [sourceRow] : []) };
        }
        if (selectCallCount === 2) {
          // loadSourceContent: filename
          return { limit: vi.fn().mockResolvedValue(sourceRow ? [{ filename: sourceRow.filename }] : []) };
        }
        // loadExistingWikiPages or computePageEmbeddings
        return Promise.resolve([]);
      }),
      orderBy: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockResolvedValue([]),
      })),
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
  let embedder: Embedder;
  let commandBus: CommandBus;

  beforeEach(() => {
    vi.clearAllMocks();
    llm = makeLlm();
    embedder = makeEmbedder();
    commandBus = makeCommandBus();
  });

  it('skips when wikiEnabled is false', async () => {
    const configStore = makeConfigStore({ wikiEnabled: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1'));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('skips when wikiAutoIngest is false and force is false', async () => {
    const configStore = makeConfigStore({ wikiAutoIngest: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', false));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('proceeds when wikiAutoIngest is false but force is true', async () => {
    const configStore = makeConfigStore({ wikiAutoIngest: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', true));

    expect(generateWikiPages).toHaveBeenCalled();
  });

  it('still skips when wikiEnabled is false even with force=true', async () => {
    const configStore = makeConfigStore({ wikiEnabled: false, wikiAutoIngest: false });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', true));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('proceeds normally when both wikiEnabled and wikiAutoIngest are true', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1'));

    expect(generateWikiPages).toHaveBeenCalled();
  });

  it('creates notes via CommandBus for generated pages', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1'));

    expect((commandBus.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('skips silently when source is not found', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb(null);
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('missing-src', 'col-1'));

    expect(generateWikiPages).not.toHaveBeenCalled();
  });

  it('embeds source content for similarity matching', async () => {
    const configStore = makeConfigStore({ wikiEnabled: true, wikiAutoIngest: true });
    const { db } = makeDb();
    const handler = new GenerateWikiPagesHandler(db, llm, embedder, configStore, commandBus);

    await handler.execute(new GenerateWikiPagesCommand('src-1', 'col-1', true));

    expect(embedder.embed).toHaveBeenCalledWith('Test content');
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
