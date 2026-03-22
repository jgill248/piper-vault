import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { WatchedFolder } from '@delve/shared';
import { ListWatchedFoldersQuery } from './list-watched-folders.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { watchedFolders } from '../../database/schema';
import { toWatchedFolderResponse } from '../dto/watched-folder-response.dto';

@QueryHandler(ListWatchedFoldersQuery)
export class ListWatchedFoldersHandler implements IQueryHandler<ListWatchedFoldersQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListWatchedFoldersQuery): Promise<WatchedFolder[]> {
    const { collectionId } = query;

    const rows = collectionId !== undefined
      ? await this.db
          .select()
          .from(watchedFolders)
          .where(eq(watchedFolders.collectionId, collectionId))
          .orderBy(watchedFolders.createdAt)
      : await this.db
          .select()
          .from(watchedFolders)
          .orderBy(watchedFolders.createdAt);

    return rows.map(toWatchedFolderResponse);
  }
}
