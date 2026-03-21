import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import type { ConversationWithMessages } from '@delve/shared';
import { GetConversationQuery } from './get-conversation.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages } from '../../database/schema';
import { toConversationWithMessages } from '../dto/conversation-response.dto';

@QueryHandler(GetConversationQuery)
export class GetConversationHandler implements IQueryHandler<GetConversationQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetConversationQuery): Promise<ConversationWithMessages> {
    const conversationRows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, query.conversationId))
      .limit(1);

    const conversation = conversationRows[0];
    if (conversation === undefined) {
      throw new NotFoundException(`Conversation with id "${query.conversationId}" not found`);
    }

    const messageRows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, query.conversationId))
      .orderBy(asc(messages.createdAt));

    return toConversationWithMessages(conversation, messageRows);
  }
}
