import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { TagCount } from '@delve/shared';
import { ListTagsQuery } from './list-tags.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

@QueryHandler(ListTagsQuery)
export class ListTagsHandler implements IQueryHandler<ListTagsQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListTagsQuery): Promise<TagCount[]> {
    // Unnest to get each tag with the number of sources carrying it
    const rows = query.collectionId
      ? await this.db.execute(
          sql`SELECT unnest(tags) AS tag, count(*)::int AS count FROM sources WHERE collection_id = ${query.collectionId} GROUP BY tag ORDER BY tag`,
        )
      : await this.db.execute(
          sql`SELECT unnest(tags) AS tag, count(*)::int AS count FROM sources GROUP BY tag ORDER BY tag`,
        );
    return (rows as unknown as Array<{ tag: string; count: number }>).map((r) => ({
      tag: r.tag,
      count: Number(r.count),
    }));
  }
}
