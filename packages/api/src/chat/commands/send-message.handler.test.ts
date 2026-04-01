import { describe, it, expect, vi } from 'vitest';
import { SendMessageHandler } from './send-message.handler';
import { SendMessageCommand } from './send-message.command';
import type { LlmProvider } from '@delve/core';
import type { Database } from '../../database/connection';
import type { RetrievalService } from '../../search/services/retrieval.service';
import type { ConfigStore } from '../../config/config.store';
import type { ChunkSearchResult } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeLlm(override?: Partial<LlmProvider>): LlmProvider {
  return {
    query: vi.fn().mockResolvedValue({
      ok: true,
      value: { content: 'Answer text.', model: 'claude-3.5-sonnet', tokensUsed: 42 },
    }),
    getModels: vi.fn().mockResolvedValue({ ok: true, value: ['claude-3.5-sonnet'] }),
    async *streamQuery() { yield { delta: 'Answer text.', done: false }; yield { delta: '', done: true, model: 'claude-3.5-sonnet' }; },
    ...override,
  };
}

function makeConfigStore(followUpQuestionsEnabled = false): ConfigStore {
  return {
    get: vi.fn().mockReturnValue({ ...DEFAULT_CONFIG, followUpQuestionsEnabled }),
    update: vi.fn(),
  } as unknown as ConfigStore;
}

function makeRetrievalService(results: ChunkSearchResult[] = []): RetrievalService {
  return {
    search: vi.fn().mockResolvedValue(results),
  } as unknown as RetrievalService;
}

function makeDb(): Database {
  let insertCallCount = 0;
  const valuesSpy = vi.fn();

  // Capture inserted values and return them with an id
  const insertReturning = vi.fn().mockImplementation(() => {
    insertCallCount++;
    const vals = valuesSpy.mock.lastCall?.[0] ?? {};
    if (insertCallCount === 1) {
      // conversations insert
      return Promise.resolve([{ id: 'conv-uuid' }]);
    }
    // messages insert — echo back the inserted values with an id
    return Promise.resolve([{
      id: insertCallCount === 2 ? 'msg-user-uuid' : 'msg-asst-uuid',
      conversationId: vals.conversationId ?? 'conv-uuid',
      role: vals.role ?? 'user',
      content: vals.content ?? '',
      sources: vals.sources ?? null,
      model: vals.model ?? null,
      createdAt: new Date(),
    }]);
  });

  valuesSpy.mockReturnValue({ returning: insertReturning });

  return {
    insert: vi.fn().mockReturnValue({
      values: valuesSpy,
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // no existing conversation
          orderBy: vi.fn().mockResolvedValue([]), // no prior messages
        }),
        orderBy: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    execute: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  } as unknown as Database;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SendMessageHandler', () => {
  it('creates a conversation and returns a ChatResponse on success', async () => {
    const db = makeDb();
    const llm = makeLlm();
    const retrievalService = makeRetrievalService();
    const handler = new SendMessageHandler(db, llm, retrievalService, makeConfigStore());

    const result = await handler.execute(new SendMessageCommand('Hello?'));

    expect(result.conversationId).toBe('conv-uuid');
    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toBe('Answer text.');
  });

  it('still returns a result when RetrievalService returns no results (graceful degradation)', async () => {
    const db = makeDb();
    const llm = makeLlm();
    const retrievalService = makeRetrievalService([]);
    const handler = new SendMessageHandler(db, llm, retrievalService, makeConfigStore());

    // Should not throw — falls back to no context, still calls LLM
    const result = await handler.execute(new SendMessageCommand('Hello?'));

    expect(result.message.content).toBe('Answer text.');
  });

  it('returns a graceful error message when LLM fails (no throw)', async () => {
    const db = makeDb();
    const llm = makeLlm({
      query: vi.fn().mockResolvedValue({ ok: false, error: 'API error' }),
    });
    const retrievalService = makeRetrievalService();
    const handler = new SendMessageHandler(db, llm, retrievalService, makeConfigStore());

    const result = await handler.execute(new SendMessageCommand('Hello?'));

    expect(result.conversationId).toBe('conv-uuid');
    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toContain('LLM provider returned an error');
  });

  it('delegates retrieval options from the command to RetrievalService', async () => {
    const db = makeDb();
    const llm = makeLlm();
    const retrievalService = makeRetrievalService();
    const handler = new SendMessageHandler(db, llm, retrievalService, makeConfigStore());

    await handler.execute(
      new SendMessageCommand('Hello?', undefined, undefined, ['src-1'], ['text/plain'], undefined, '2026-01-01', '2026-12-31'),
    );

    expect(retrievalService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIds: ['src-1'],
        fileTypes: ['text/plain'],
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }),
    );
  });

  // Follow-up generation is currently disabled in the handler to avoid
  // latency from an extra LLM round-trip (see TODO in handler for Phase 6).
  // All follow-up related tests verify the current behavior: no follow-ups returned.

  it('omits suggestedFollowUps (generation disabled to avoid latency)', async () => {
    const db = makeDb();
    const llm = makeLlm();
    const contextResult: ChunkSearchResult = {
      chunk: {
        id: 'c-1', sourceId: 'src-1', chunkIndex: 0, content: 'context',
        tokenCount: 5, metadata: {}, createdAt: new Date(),
      },
      score: 0.9,
      source: { id: 'src-1', filename: 'test.md', fileType: 'text/markdown' },
    };
    const retrievalService = makeRetrievalService([contextResult]);
    const handler = new SendMessageHandler(db, llm, retrievalService, makeConfigStore(true));

    const result = await handler.execute(new SendMessageCommand('Hello?'));

    expect(result.suggestedFollowUps).toBeUndefined();
    expect(result.message.content).toBe('Answer text.');
    expect(result.message.sources).toEqual(['src-1']);
    expect(result.message.sourceNames).toEqual(['test.md']);
  });
});
