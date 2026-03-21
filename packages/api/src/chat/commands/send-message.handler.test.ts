import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';
import { SendMessageHandler } from './send-message.handler';
import { SendMessageCommand } from './send-message.command';
import type { Embedder } from '@delve/core';
import type { LlmProvider } from '@delve/core';
import type { Database } from '../../database/connection';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeEmbedder(override?: Partial<Embedder>): Embedder {
  return {
    dimensions: 384,
    embed: vi.fn().mockResolvedValue({ ok: true, value: new Array(384).fill(0.1) }),
    embedBatch: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    ...override,
  };
}

function makeLlm(override?: Partial<LlmProvider>): LlmProvider {
  return {
    query: vi.fn().mockResolvedValue({
      ok: true,
      value: { content: 'Answer text.', model: 'claude-3.5-sonnet', tokensUsed: 42 },
    }),
    getModels: vi.fn().mockResolvedValue({ ok: true, value: ['claude-3.5-sonnet'] }),
    ...override,
  };
}

function makeDb(): Database {
  const insertReturning = vi.fn();

  // conversations insert
  insertReturning
    .mockResolvedValueOnce([{ id: 'conv-uuid' }]) // create conversation
    .mockResolvedValueOnce([{                       // save user message
      id: 'msg-user-uuid',
      conversationId: 'conv-uuid',
      role: 'user',
      content: 'Hello?',
      sources: null,
      model: null,
      createdAt: new Date(),
    }])
    .mockResolvedValueOnce([{                       // save assistant message
      id: 'msg-asst-uuid',
      conversationId: 'conv-uuid',
      role: 'assistant',
      content: 'Answer text.',
      sources: null,
      model: 'claude-3.5-sonnet',
      createdAt: new Date(),
    }]);

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: insertReturning }),
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
    execute: vi.fn().mockResolvedValue([]), // vector search returns empty
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
    const embedder = makeEmbedder();
    const llm = makeLlm();
    const handler = new SendMessageHandler(db, embedder, llm);

    const result = await handler.execute(new SendMessageCommand('Hello?'));

    expect(result.conversationId).toBe('conv-uuid');
    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toBe('Answer text.');
  });

  it('still returns a result when embedding fails (graceful degradation)', async () => {
    const db = makeDb();
    const embedder = makeEmbedder({
      embed: vi.fn().mockResolvedValue({ ok: false, error: 'unavailable' }),
    });
    const llm = makeLlm();
    const handler = new SendMessageHandler(db, embedder, llm);

    // Should not throw — falls back to no context, still calls LLM
    const result = await handler.execute(new SendMessageCommand('Hello?'));

    expect(result.message.content).toBe('Answer text.');
  });

  it('throws InternalServerErrorException when LLM fails', async () => {
    const db = makeDb();
    const embedder = makeEmbedder();
    const llm = makeLlm({
      query: vi.fn().mockResolvedValue({ ok: false, error: 'API error' }),
    });
    const handler = new SendMessageHandler(db, embedder, llm);

    await expect(handler.execute(new SendMessageCommand('Hello?'))).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
