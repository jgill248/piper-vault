import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DeleteFolderCommand } from './delete-folder.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { noteFolders, sources } from '../../database/schema';

@CommandHandler(DeleteFolderCommand)
export class DeleteFolderHandler implements ICommandHandler<DeleteFolderCommand> {
  private readonly logger = new Logger(DeleteFolderHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: DeleteFolderCommand): Promise<Result<void, string>> {
    const { folderId, deleteContents } = command;

    const existing = await this.db
      .select()
      .from(noteFolders)
      .where(eq(noteFolders.id, folderId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Folder "${folderId}" not found`);
    }

    const folderPath = existing[0]!.path;

    if (deleteContents) {
      // Delete all notes in this folder
      await this.db.delete(sources).where(eq(sources.parentPath, folderPath));
    } else {
      // Move notes to root (null parent_path)
      await this.db
        .update(sources)
        .set({ parentPath: null, updatedAt: new Date() })
        .where(eq(sources.parentPath, folderPath));
    }

    // Delete the folder
    await this.db.delete(noteFolders).where(eq(noteFolders.id, folderId));

    this.logger.log(`Deleted folder "${folderPath}" (deleteContents: ${deleteContents})`);
    return { ok: true, value: undefined };
  }
}
