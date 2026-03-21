import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DeleteSourceCommand } from './delete-source.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';

@CommandHandler(DeleteSourceCommand)
export class DeleteSourceHandler implements ICommandHandler<DeleteSourceCommand> {
  private readonly logger = new Logger(DeleteSourceHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: DeleteSourceCommand): Promise<Result<void, string>> {
    const { sourceId } = command;

    const existing = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Source with id "${sourceId}" not found`);
    }

    // Chunks are deleted automatically via ON DELETE CASCADE on the FK.
    await this.db.delete(sources).where(eq(sources.id, sourceId));

    this.logger.log(`Deleted source ${sourceId}`);
    return { ok: true, value: undefined };
  }
}
