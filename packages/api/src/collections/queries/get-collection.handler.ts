import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Collection } from '@delve/shared';
import { GetCollectionQuery } from './get-collection.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { collections } from '../../database/schema';
import { toCollectionResponse } from '../dto/collection-response.dto';

@QueryHandler(GetCollectionQuery)
export class GetCollectionHandler implements IQueryHandler<GetCollectionQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetCollectionQuery): Promise<Collection> {
    const rows = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, query.id))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Collection with id "${query.id}" not found`);
    }

    return toCollectionResponse(row);
  }
}
