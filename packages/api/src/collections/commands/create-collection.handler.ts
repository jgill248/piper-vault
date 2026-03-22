import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import type { Collection } from '@delve/shared';
import { CreateCollectionCommand } from './create-collection.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { collections } from '../../database/schema';
import { toCollectionResponse } from '../dto/collection-response.dto';

@CommandHandler(CreateCollectionCommand)
export class CreateCollectionHandler
  implements ICommandHandler<CreateCollectionCommand>
{
  private readonly logger = new Logger(CreateCollectionHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: CreateCollectionCommand): Promise<Collection> {
    const [inserted] = await this.db
      .insert(collections)
      .values({
        name: command.name,
        description: command.description ?? '',
        metadata: (command.metadata ?? {}) as Record<string, unknown>,
        userId: command.userId ?? null,
      })
      .returning();

    if (inserted === undefined) {
      this.logger.error('Insert into collections returned no rows');
      throw new InternalServerErrorException('Failed to create collection');
    }

    this.logger.log(`Created collection "${command.name}" (id: ${inserted.id})`);
    return toCollectionResponse(inserted);
  }
}
