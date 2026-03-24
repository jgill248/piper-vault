import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result, NoteFolder } from '@delve/shared';
import { CreateFolderCommand } from './create-folder.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { noteFolders } from '../../database/schema';

@CommandHandler(CreateFolderCommand)
export class CreateFolderHandler implements ICommandHandler<CreateFolderCommand> {
  private readonly logger = new Logger(CreateFolderHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: CreateFolderCommand): Promise<Result<NoteFolder, string>> {
    const { path, collectionId } = command;

    // Check for existing folder
    const existing = await this.db
      .select()
      .from(noteFolders)
      .where(eq(noteFolders.path, path))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Folder "${path}" already exists`);
    }

    const [inserted] = await this.db
      .insert(noteFolders)
      .values({ path, collectionId })
      .returning();

    if (inserted === undefined) {
      return { ok: false, error: 'Failed to create folder' };
    }

    this.logger.log(`Created folder "${path}"`);
    return { ok: true, value: inserted as NoteFolder };
  }
}
