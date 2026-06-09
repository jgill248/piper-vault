import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { RenameTagCommand } from './rename-tag.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

export interface RenameTagResult {
  readonly affectedCount: number;
}

@CommandHandler(RenameTagCommand)
export class RenameTagHandler implements ICommandHandler<RenameTagCommand> {
  private readonly logger = new Logger(RenameTagHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: RenameTagCommand): Promise<Result<RenameTagResult, string>> {
    const oldTag = command.oldTag.trim();
    const newTag = command.newTag.trim();

    if (!oldTag || !newTag) {
      return { ok: false, error: 'Both oldTag and newTag are required' };
    }
    if (oldTag === newTag) {
      return { ok: false, error: 'oldTag and newTag are identical' };
    }

    // Replace the tag and deduplicate in one statement — a source carrying
    // both tags ends up with a single occurrence of the new tag (merge).
    const rows = command.collectionId
      ? await this.db.execute(sql`
          UPDATE sources
          SET tags = ARRAY(SELECT DISTINCT t FROM unnest(array_replace(tags, ${oldTag}, ${newTag})) AS t ORDER BY t),
              updated_at = now()
          WHERE ${oldTag} = ANY(tags) AND collection_id = ${command.collectionId}
          RETURNING id
        `)
      : await this.db.execute(sql`
          UPDATE sources
          SET tags = ARRAY(SELECT DISTINCT t FROM unnest(array_replace(tags, ${oldTag}, ${newTag})) AS t ORDER BY t),
              updated_at = now()
          WHERE ${oldTag} = ANY(tags)
          RETURNING id
        `);

    const affectedCount = (rows as unknown as Array<{ id: string }>).length;
    this.logger.log(`Renamed tag "${oldTag}" → "${newTag}" on ${affectedCount} source(s)`);

    return { ok: true, value: { affectedCount } };
  }
}
