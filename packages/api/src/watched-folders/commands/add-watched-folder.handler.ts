import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException } from '@nestjs/common';
import { existsSync, statSync } from 'node:fs';
import { AddWatchedFolderCommand } from './add-watched-folder.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { watchedFolders } from '../../database/schema';
import type { WatchedFolderRow } from '../../database/schema';
import { sanitizePath } from '../../common/path-validator';

@CommandHandler(AddWatchedFolderCommand)
export class AddWatchedFolderHandler implements ICommandHandler<AddWatchedFolderCommand> {
  private readonly logger = new Logger(AddWatchedFolderHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: AddWatchedFolderCommand): Promise<WatchedFolderRow> {
    const { collectionId, recursive } = command;

    // Sanitize path to prevent traversal attacks (CWE-22)
    const folderPath = sanitizePath(command.folderPath);

    // Validate that the folder exists and is a directory
    if (!existsSync(folderPath)) {
      throw new BadRequestException({
        error: { code: 'DIRECTORY_NOT_FOUND', message: `Directory not found: ${folderPath}` },
      });
    }

    const stat = statSync(folderPath);
    if (!stat.isDirectory()) {
      throw new BadRequestException({
        error: { code: 'NOT_A_DIRECTORY', message: `Path is not a directory: ${folderPath}` },
      });
    }

    const [inserted] = await this.db
      .insert(watchedFolders)
      .values({ collectionId, folderPath, recursive })
      .returning();

    if (inserted === undefined) {
      throw new Error('Insert returned no rows');
    }

    this.logger.log(`Added watched folder: "${folderPath}" (collection: ${collectionId})`);
    return inserted;
  }
}
