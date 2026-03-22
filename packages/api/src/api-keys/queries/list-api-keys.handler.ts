import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { ApiKey } from '@delve/shared';
import { ListApiKeysQuery } from './list-api-keys.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { apiKeys } from '../../database/schema';
import { toApiKeyResponse } from '../dto/api-key-response.dto';

@QueryHandler(ListApiKeysQuery)
export class ListApiKeysHandler implements IQueryHandler<ListApiKeysQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListApiKeysQuery): Promise<ApiKey[]> {
    const rows = query.collectionId
      ? await this.db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.collectionId, query.collectionId))
          .orderBy(apiKeys.createdAt)
      : await this.db.select().from(apiKeys).orderBy(apiKeys.createdAt);

    return rows.map(toApiKeyResponse);
  }
}
