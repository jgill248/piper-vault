import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, like } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { RenameFolderCommand } from './rename-folder.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { noteFolders, sources } from '../../database/schema';

@CommandHandler(RenameFolderCommand)
export class RenameFolderHandler implements ICommandHandler<RenameFolderCommand> {
  private readonly logger = new Logger(RenameFolderHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: RenameFolderCommand): Promise<Result<void, string>> {
    const { folderId, newPath } = command;

    const existing = await this.db
      .select()
      .from(noteFolders)
      .where(eq(noteFolders.id, folderId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Folder "${folderId}" not found`);
    }

    const oldPath = existing[0]!.path;

    // Update the folder path
    await this.db
      .update(noteFolders)
      .set({ path: newPath })
      .where(eq(noteFolders.id, folderId));

    // Cascade: update all notes with this parent_path
    await this.db
      .update(sources)
      .set({ parentPath: newPath, updatedAt: new Date() })
      .where(eq(sources.parentPath, oldPath));

    // Cascade: update child folders (those whose path starts with oldPath/)
    const childFolders = await this.db
      .select()
      .from(noteFolders)
      .where(like(noteFolders.path, `${oldPath}/%`));

    for (const child of childFolders) {
      const updatedChildPath = newPath + child.path.slice(oldPath.length);
      await this.db
        .update(noteFolders)
        .set({ path: updatedChildPath })
        .where(eq(noteFolders.id, child.id));

      // Update notes in child folders
      await this.db
        .update(sources)
        .set({ parentPath: updatedChildPath, updatedAt: new Date() })
        .where(eq(sources.parentPath, child.path));
    }

    this.logger.log(`Renamed folder "${oldPath}" → "${newPath}"`);
    return { ok: true, value: undefined };
  }
}
