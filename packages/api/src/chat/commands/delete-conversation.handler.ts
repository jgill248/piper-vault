import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DeleteConversationCommand } from './delete-conversation.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations } from '../../database/schema';

@CommandHandler(DeleteConversationCommand)
export class DeleteConversationHandler
  implements ICommandHandler<DeleteConversationCommand>
{
  private readonly logger = new Logger(DeleteConversationHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: DeleteConversationCommand): Promise<Result<void, string>> {
    const { id } = command;

    const existing = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Conversation with id "${id}" not found`);
    }

    // Messages are deleted automatically via ON DELETE CASCADE on the FK.
    await this.db.delete(conversations).where(eq(conversations.id, id));

    this.logger.log(`Deleted conversation ${id}`);
    return { ok: true, value: undefined };
  }
}
