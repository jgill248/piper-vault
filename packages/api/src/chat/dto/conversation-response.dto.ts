import type { Conversation, ConversationWithMessages, Message } from '@delve/shared';
import type { ConversationRow, MessageRow } from '../../database/schema';

export function toMessageResponse(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Message['role'],
    content: row.content,
    sources: Array.isArray(row.sources) ? (row.sources as string[]) : undefined,
    model: row.model ?? undefined,
    createdAt: row.createdAt,
  };
}

export function toConversationResponse(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toConversationWithMessages(
  row: ConversationRow,
  messageRows: MessageRow[],
): ConversationWithMessages {
  return {
    ...toConversationResponse(row),
    messages: messageRows.map(toMessageResponse),
  };
}
