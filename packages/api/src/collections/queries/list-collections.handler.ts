import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { sql, eq, or, isNull } from 'drizzle-orm';
import type { PaginatedResponse, Collection } from '@delve/shared';
import { ListCollectionsQuery } from './list-collections.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { collections } from '../../database/schema';
import { toCollectionResponse } from '../dto/collection-response.dto';

@QueryHandler(ListCollectionsQuery)
export class ListCollectionsHandler
  implements IQueryHandler<ListCollectionsQuery>
{
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(
    query: ListCollectionsQuery,
  ): Promise<PaginatedResponse<Collection>> {
    const { page, pageSize, userId, isAdmin } = query;
    const offset = (page - 1) * pageSize;

    // When auth is enabled and the caller is not an admin, filter to their own
    // collections plus unowned (null userId) collections such as the default.
    // When auth is disabled (no userId, not admin) return all.
    const whereClause =
      userId !== undefined && !isAdmin
        ? or(eq(collections.userId, userId), isNull(collections.userId))
        : undefined;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(collections)
        .where(whereClause)
        .orderBy(collections.createdAt)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(collections)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      data: rows.map(toCollectionResponse),
      total,
      page,
      pageSize,
      hasMore: offset + rows.length < total,
    };
  }
}
