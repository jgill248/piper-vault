import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DeleteTagCommand } from './delete-tag.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

export interface DeleteTagResult {
  readonly affectedCount: number;
}

@CommandHandler(DeleteTagCommand)
export class DeleteTagHandler implements ICommandHandler<DeleteTagCommand> {
  private readonly logger = new Logger(DeleteTagHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: DeleteTagCommand): Promise<Result<DeleteTagResult, string>> {
    const tag = command.tag.trim();
    if (!tag) {
      return { ok: false, error: 'tag is required' };
    }

    const rows = command.collectionId
      ? await this.db.execute(sql`
          UPDATE sources
          SET tags = array_remove(tags, ${tag}), updated_at = now()
          WHERE ${tag} = ANY(tags) AND collection_id = ${command.collectionId}
          RETURNING id
        `)
      : await this.db.execute(sql`
          UPDATE sources
          SET tags = array_remove(tags, ${tag}), updated_at = now()
          WHERE ${tag} = ANY(tags)
          RETURNING id
        `);

    const affectedCount = (rows as unknown as Array<{ id: string }>).length;
    this.logger.log(`Deleted tag "${tag}" from ${affectedCount} source(s)`);

    return { ok: true, value: { affectedCount } };
  }
}
