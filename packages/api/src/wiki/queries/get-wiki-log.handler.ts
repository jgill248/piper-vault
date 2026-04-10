import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { desc, eq, ne, sql } from 'drizzle-orm';
import { GetWikiLogQuery } from './get-wiki-log.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { wikiLog } from '../../database/schema';
import type { WikiLogRow } from '../../database/schema';

@QueryHandler(GetWikiLogQuery)
export class GetWikiLogHandler implements IQueryHandler<GetWikiLogQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetWikiLogQuery): Promise<{ items: WikiLogRow[]; total: number }> {
    const { limit, offset, operation } = query;

    // When filtering by a specific operation, show it.
    // Otherwise exclude internal 'index' cache entries from the user-facing log.
    const condition = operation
      ? eq(wikiLog.operation, operation)
      : ne(wikiLog.operation, 'index');

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(wikiLog)
        .where(condition)
        .orderBy(desc(wikiLog.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(wikiLog)
        .where(condition),
    ]);

    return { items, total: Number(countResult[0]?.count ?? 0) };
  }
}
