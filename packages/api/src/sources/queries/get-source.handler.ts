import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Source } from '@delve/shared';
import { GetSourceQuery } from './get-source.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';
import { toSourceResponse } from '../dto/source-response.dto';

@QueryHandler(GetSourceQuery)
export class GetSourceHandler implements IQueryHandler<GetSourceQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetSourceQuery): Promise<Source> {
    const rows = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, query.sourceId))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Source with id "${query.sourceId}" not found`);
    }

    return toSourceResponse(row);
  }
}
