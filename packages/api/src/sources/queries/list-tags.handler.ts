import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ListTagsQuery } from './list-tags.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

@QueryHandler(ListTagsQuery)
export class ListTagsHandler implements IQueryHandler<ListTagsQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(_query: ListTagsQuery): Promise<string[]> {
    // Use unnest to get unique tags across all sources, sorted alphabetically
    const rows = await this.db.execute(
      sql`SELECT DISTINCT unnest(tags) AS tag FROM sources ORDER BY tag`,
    );
    return (rows as unknown as Array<{ tag: string }>).map(r => r.tag);
  }
}
