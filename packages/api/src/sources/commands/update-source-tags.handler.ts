import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { UpdateSourceTagsCommand } from './update-source-tags.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';

@CommandHandler(UpdateSourceTagsCommand)
export class UpdateSourceTagsHandler implements ICommandHandler<UpdateSourceTagsCommand> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: UpdateSourceTagsCommand): Promise<{ tags: string[] }> {
    const [source] = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.id, command.sourceId))
      .limit(1);

    if (!source) throw new NotFoundException(`Source ${command.sourceId} not found`);

    await this.db
      .update(sources)
      .set({ tags: command.tags, updatedAt: new Date() })
      .where(eq(sources.id, command.sourceId));

    return { tags: command.tags };
  }
}
