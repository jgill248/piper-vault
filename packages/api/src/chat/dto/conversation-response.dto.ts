import { inArray } from 'drizzle-orm';
import type { Conversation, ConversationWithMessages, Message, ChunkSearchResult } from '@delve/shared';
import type { ConversationRow, MessageRow } from '../../database/schema';
import { sources } from '../../database/schema';
import type { Database } from '../../database/connection';

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
    collectionId: row.collectionId,
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

/**
 * Batch-enrich messages with source filenames by querying the sources table.
 */
export async function enrichMessagesWithSourceNames(
  msgs: readonly Message[],
  db: Database,
): Promise<Message[]> {
  const allSourceIds = new Set<string>();
  for (const msg of msgs) {
    if (msg.sources) {
      for (const sid of msg.sources) allSourceIds.add(sid);
    }
  }
  if (allSourceIds.size === 0) return [...msgs];

  const sourceRows = await db
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, [...allSourceIds]));

  const idToFilename = new Map<string, string>();
  for (const row of sourceRows) {
    idToFilename.set(row.id, row.filename);
  }

  return msgs.map((msg) => {
    if (!msg.sources || msg.sources.length === 0) return msg;
    return {
      ...msg,
      sourceNames: msg.sources.map((sid) => idToFilename.get(sid) ?? sid),
    };
  });
}

/**
 * Enrich a single message with source filenames from already-available context results.
 * Avoids an extra DB round-trip when the caller has ChunkSearchResult[].
 */
export function enrichMessageFromContext(
  msg: Message,
  contextResults: ChunkSearchResult[],
  noteFilenames?: Map<string, string>,
): Message {
  if (!msg.sources || msg.sources.length === 0) return msg;

  const idToFilename = new Map<string, string>();
  for (const r of contextResults) {
    idToFilename.set(r.source.id, r.source.filename);
  }
  if (noteFilenames) {
    for (const [id, name] of noteFilenames) idToFilename.set(id, name);
  }

  return {
    ...msg,
    sourceNames: msg.sources.map((sid) => idToFilename.get(sid) ?? sid),
  };
}
