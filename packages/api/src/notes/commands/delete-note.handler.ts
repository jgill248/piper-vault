import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DeleteNoteCommand } from './delete-note.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';

@CommandHandler(DeleteNoteCommand)
export class DeleteNoteHandler implements ICommandHandler<DeleteNoteCommand> {
  private readonly logger = new Logger(DeleteNoteHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: DeleteNoteCommand): Promise<Result<void, string>> {
    const { noteId } = command;

    const existing = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.id, noteId), eq(sources.isNote, true)))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Note with id "${noteId}" not found`);
    }

    // Chunks and source_links are deleted via ON DELETE CASCADE
    await this.db.delete(sources).where(eq(sources.id, noteId));

    this.logger.log(`Deleted note ${noteId}`);
    return { ok: true, value: undefined };
  }
}
