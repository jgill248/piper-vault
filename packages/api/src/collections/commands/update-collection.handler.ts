import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Collection } from '@delve/shared';
import { UpdateCollectionCommand } from './update-collection.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { collections } from '../../database/schema';
import { toCollectionResponse } from '../dto/collection-response.dto';

@CommandHandler(UpdateCollectionCommand)
export class UpdateCollectionHandler
  implements ICommandHandler<UpdateCollectionCommand>
{
  private readonly logger = new Logger(UpdateCollectionHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: UpdateCollectionCommand): Promise<Collection> {
    // Build only the fields that were actually provided
    const patch: Partial<{
      name: string;
      description: string;
      metadata: Record<string, unknown>;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (command.name !== undefined) patch.name = command.name;
    if (command.description !== undefined) patch.description = command.description;
    if (command.metadata !== undefined)
      patch.metadata = command.metadata as Record<string, unknown>;

    const [updated] = await this.db
      .update(collections)
      .set(patch)
      .where(eq(collections.id, command.id))
      .returning();

    if (updated === undefined) {
      throw new NotFoundException(`Collection with id "${command.id}" not found`);
    }

    this.logger.log(`Updated collection "${command.id}"`);
    return toCollectionResponse(updated);
  }
}
