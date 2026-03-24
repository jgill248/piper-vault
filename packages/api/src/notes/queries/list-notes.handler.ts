import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq, and, sql, ilike, arrayContains } from 'drizzle-orm';
import type { PaginatedResponse, Source } from '@delve/shared';
import { ListNotesQuery } from './list-notes.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';
import { toSourceResponse } from '../../sources/dto/source-response.dto';

@QueryHandler(ListNotesQuery)
export class ListNotesHandler implements IQueryHandler<ListNotesQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListNotesQuery): Promise<PaginatedResponse<Source>> {
    const { page, pageSize, collectionId, parentPath, search, tag } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(sources.isNote, true)];

    if (collectionId !== undefined) {
      conditions.push(eq(sources.collectionId, collectionId));
    }
    if (parentPath !== undefined) {
      conditions.push(
        parentPath === ''
          ? sql`${sources.parentPath} IS NULL`
          : eq(sources.parentPath, parentPath),
      );
    }
    if (search !== undefined && search.length > 0) {
      conditions.push(ilike(sources.title, `%${search}%`));
    }
    if (tag !== undefined) {
      conditions.push(arrayContains(sources.tags, [tag]));
    }

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(sources)
        .where(where)
        .orderBy(sources.updatedAt)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(sources)
        .where(where),
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
