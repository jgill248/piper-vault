import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { RevokeApiKeyCommand } from './revoke-api-key.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { apiKeys } from '../../database/schema';

@CommandHandler(RevokeApiKeyCommand)
export class RevokeApiKeyHandler implements ICommandHandler<RevokeApiKeyCommand> {
  private readonly logger = new Logger(RevokeApiKeyHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: RevokeApiKeyCommand): Promise<void> {
    const deleted = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.id, command.id))
      .returning({ id: apiKeys.id });

    if (deleted.length === 0) {
      throw new NotFoundException({
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: `API key with id "${command.id}" not found`,
        },
      });
    }

    this.logger.log(`Revoked API key ${command.id}`);
  }
}
