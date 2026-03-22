import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import { DeleteCollectionCommand } from './delete-collection.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { collections, sources, conversations } from '../../database/schema';

@CommandHandler(DeleteCollectionCommand)
export class DeleteCollectionHandler
  implements ICommandHandler<DeleteCollectionCommand>
{
  private readonly logger = new Logger(DeleteCollectionHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: DeleteCollectionCommand): Promise<void> {
    if (command.id === DEFAULT_COLLECTION_ID) {
      throw new BadRequestException({
        error: {
          code: 'CANNOT_DELETE_DEFAULT_COLLECTION',
          message: 'The default collection cannot be deleted',
        },
      });
    }

    // Verify the collection exists
    const existing = await this.db
      .select({ id: collections.id, userId: collections.userId })
      .from(collections)
      .where(eq(collections.id, command.id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Collection with id "${command.id}" not found`);
    }

    // Ownership check: when a non-admin user is deleting, verify they own it
    const collection = existing[0]!;
    if (
      command.requestingUserId !== undefined &&
      !command.requestingUserIsAdmin
    ) {
      if (
        collection.userId !== null &&
        collection.userId !== command.requestingUserId
      ) {
        throw new ForbiddenException({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to delete this collection',
          },
        });
      }
    }

    if (command.mode === 'cascade') {
      // Sources will cascade-delete their chunks via FK; conversations cascade messages
      await this.db.delete(sources).where(eq(sources.collectionId, command.id));
      await this.db
        .delete(conversations)
        .where(eq(conversations.collectionId, command.id));
    } else {
      // Reassign sources and conversations to the default collection
      await this.db
        .update(sources)
        .set({ collectionId: DEFAULT_COLLECTION_ID, updatedAt: new Date() })
        .where(eq(sources.collectionId, command.id));
      await this.db
        .update(conversations)
        .set({
          collectionId: DEFAULT_COLLECTION_ID,
          updatedAt: new Date(),
        })
        .where(eq(conversations.collectionId, command.id));
    }

    await this.db.delete(collections).where(eq(collections.id, command.id));

    this.logger.log(
      `Deleted collection "${command.id}" (mode: ${command.mode})`,
    );
  }
}
