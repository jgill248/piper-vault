import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ExportConversationHandler } from './export-conversation.handler';
import { ExportConversationQuery } from './export-conversation.query';
import type { Database } from '../../database/connection';

function makeDb(
  conversationRow: Record<string, unknown> | undefined,
  messageRows: Record<string, unknown>[] = [],
): Database {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(conversationRow ? [conversationRow] : []),
          orderBy: vi.fn().mockResolvedValue(messageRows),
        }),
        orderBy: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(messageRows),
          }),
        }),
      }),
    }),
  } as unknown as Database;
}

const NOW = new Date('2026-03-20T12:00:00Z');

describe('ExportConversationHandler', () => {
  it('throws NotFoundException when conversation does not exist', async () => {
    const db = makeDb(undefined);
    const handler = new ExportConversationHandler(db);

    await expect(
      handler.execute(new ExportConversationQuery('missing-id')),
    ).rejects.toThrow(NotFoundException);
  });

  it('exports a conversation with messages as markdown', async () => {
    const conversation = {
      id: 'conv-1',
      title: 'Test conversation',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const msgs = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'Hello',
        sources: null,
        model: null,
        createdAt: NOW,
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Hi there!',
        sources: ['src-1'],
        model: 'claude-3.5-sonnet',
        createdAt: NOW,
      },
    ];

    const db = makeDb(conversation, msgs);
    const handler = new ExportConversationHandler(db);
    const result = await handler.execute(new ExportConversationQuery('conv-1'));

    expect(typeof result).toBe('string');
    expect(result).toContain('Test conversation');
    expect(result).toContain('Hello');
    expect(result).toContain('Hi there!');
  });

  it('handles a conversation with no messages', async () => {
    const conversation = {
      id: 'conv-1',
      title: 'Empty chat',
      createdAt: NOW,
      updatedAt: NOW,
    };

    const db = makeDb(conversation, []);
    const handler = new ExportConversationHandler(db);
    const result = await handler.execute(new ExportConversationQuery('conv-1'));

    expect(typeof result).toBe('string');
    expect(result).toContain('Empty chat');
  });
});
