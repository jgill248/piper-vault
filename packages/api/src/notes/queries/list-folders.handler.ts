import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import type { NoteFolder } from '@delve/shared';
import { ListFoldersQuery } from './list-folders.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { noteFolders } from '../../database/schema';

@QueryHandler(ListFoldersQuery)
export class ListFoldersHandler implements IQueryHandler<ListFoldersQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ListFoldersQuery): Promise<readonly NoteFolder[]> {
    const { collectionId } = query;

    const rows = collectionId !== undefined
      ? await this.db
          .select()
          .from(noteFolders)
          .where(eq(noteFolders.collectionId, collectionId))
          .orderBy(asc(noteFolders.path))
      : await this.db
          .select()
          .from(noteFolders)
          .orderBy(asc(noteFolders.path));

    return rows as NoteFolder[];
  }
}
