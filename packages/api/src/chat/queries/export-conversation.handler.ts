import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { exportConversationAsMarkdown } from '@delve/core';
import { ExportConversationQuery } from './export-conversation.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages } from '../../database/schema';
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
    return exportConversationAsMarkdown(conversationWithMessages);
  }
}
