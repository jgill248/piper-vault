import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PaginatedResponse, Source } from '@delve/shared';
import { ListSourcesQuery } from './list-sources.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';
import { toSourceResponse } from '../dto/source-response.dto';

@QueryHandler(ListSourcesQuery)
export class ListSourcesHandler implements IQueryHandler<ListSourcesQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListSourcesQuery): Promise<PaginatedResponse<Source>> {
    const { page, pageSize } = query;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(sources)
        .orderBy(sources.createdAt)
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(sources),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      data: rows.map(toSourceResponse),
      total,
      page,
      pageSize,
      hasMore: offset + rows.length < total,
    };
  }
}
