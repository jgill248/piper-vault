import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq, asc, inArray } from 'drizzle-orm';
import { exportConversationAsMarkdown } from '@delve/core';
import { ExportConversationQuery } from './export-conversation.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages, sources } from '../../database/schema';
import { toConversationWithMessages } from '../dto/conversation-response.dto';

@QueryHandler(ExportConversationQuery)
export class ExportConversationHandler implements IQueryHandler<ExportConversationQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ExportConversationQuery): Promise<string> {
    const conversationRows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, query.id))
      .limit(1);

    const conversation = conversationRows[0];
    if (conversation === undefined) {
      throw new NotFoundException(`Conversation with id "${query.id}" not found`);
    }

    const messageRows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, query.id))
      .orderBy(asc(messages.createdAt));

    const conversationWithMessages = toConversationWithMessages(conversation, messageRows);

    if (query.format === 'wikilink') {
      // Build sourceId → filename map for wiki-link citations
      const allSourceIds = new Set<string>();
      for (const msg of conversationWithMessages.messages) {
        if (msg.sources) {
          for (const sid of msg.sources) {
            allSourceIds.add(sid);
          }
        }
      }

      const sourceIdToFilename = new Map<string, string>();
      if (allSourceIds.size > 0) {
        const sourceRows = await this.db
          .select({ id: sources.id, filename: sources.filename })
          .from(sources)
          .where(inArray(sources.id, [...allSourceIds]));
        for (const row of sourceRows) {
          sourceIdToFilename.set(row.id, row.filename);
        }
      }

      return exportConversationAsMarkdown(conversationWithMessages, { sourceIdToFilename });
    }

    return exportConversationAsMarkdown(conversationWithMessages);
  }
}
