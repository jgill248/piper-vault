import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { Source } from '@delve/shared';
import { GetNoteQuery } from './get-note.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, sourceLinks } from '../../database/schema';
import { toSourceResponse } from '../../sources/dto/source-response.dto';

@QueryHandler(GetNoteQuery)
export class GetNoteHandler implements IQueryHandler<GetNoteQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetNoteQuery): Promise<Source & { linkCount: number; backlinkCount: number }> {
    const rows = await this.db
      .select()
      .from(sources)
      .where(and(eq(sources.id, query.noteId), eq(sources.isNote, true)))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Note with id "${query.noteId}" not found`);
    }

    // Count outgoing and incoming links
    const [outgoing, incoming] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceLinks)
        .where(eq(sourceLinks.sourceId, query.noteId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceLinks)
        .where(eq(sourceLinks.targetSourceId, query.noteId)),
    ]);

    return {
      ...toSourceResponse(row),
      linkCount: outgoing[0]?.count ?? 0,
      backlinkCount: incoming[0]?.count ?? 0,
    };
  }
}
