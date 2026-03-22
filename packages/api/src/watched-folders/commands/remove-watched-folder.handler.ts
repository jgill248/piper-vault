import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { RemoveWatchedFolderCommand } from './remove-watched-folder.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { watchedFolders } from '../../database/schema';

@CommandHandler(RemoveWatchedFolderCommand)
export class RemoveWatchedFolderHandler implements ICommandHandler<RemoveWatchedFolderCommand> {
  private readonly logger = new Logger(RemoveWatchedFolderHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: RemoveWatchedFolderCommand): Promise<Result<void, string>> {
    const { watchedFolderId } = command;

    const existing = await this.db
      .select({ id: watchedFolders.id })
      .from(watchedFolders)
      .where(eq(watchedFolders.id, watchedFolderId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Watched folder with id "${watchedFolderId}" not found`);
    }

    await this.db.delete(watchedFolders).where(eq(watchedFolders.id, watchedFolderId));

    this.logger.log(`Removed watched folder ${watchedFolderId}`);
    return { ok: true, value: undefined };
  }
}
