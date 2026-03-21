import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import type { PaginatedResponse, Conversation } from '@delve/shared';
import { ListConversationsQuery } from './list-conversations.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations } from '../../database/schema';
import { toConversationResponse } from '../dto/conversation-response.dto';

@QueryHandler(ListConversationsQuery)
export class ListConversationsHandler implements IQueryHandler<ListConversationsQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListConversationsQuery): Promise<PaginatedResponse<Conversation>> {
    const { page, pageSize } = query;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(conversations),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      data: rows.map(toConversationResponse),
      total,
      page,
      pageSize,
      hasMore: offset + rows.length < total,
    };
  }
}
