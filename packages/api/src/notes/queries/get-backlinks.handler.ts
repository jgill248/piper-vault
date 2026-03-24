import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { SourceLink } from '@delve/shared';
import { GetBacklinksQuery } from './get-backlinks.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sourceLinks, sources } from '../../database/schema';

export interface BacklinkEntry {
  readonly link: SourceLink;
  readonly sourceFilename: string;
  readonly sourceTitle: string | null;
}

@QueryHandler(GetBacklinksQuery)
export class GetBacklinksHandler implements IQueryHandler<GetBacklinksQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetBacklinksQuery): Promise<readonly BacklinkEntry[]> {
    const rows = await this.db
      .select({
        id: sourceLinks.id,
        sourceId: sourceLinks.sourceId,
        targetSourceId: sourceLinks.targetSourceId,
        targetFilename: sourceLinks.targetFilename,
        linkType: sourceLinks.linkType,
        displayText: sourceLinks.displayText,
        section: sourceLinks.section,
        createdAt: sourceLinks.createdAt,
        sourceFilename: sources.filename,
        sourceTitle: sources.title,
      })
      .from(sourceLinks)
      .innerJoin(sources, eq(sourceLinks.sourceId, sources.id))
      .where(eq(sourceLinks.targetSourceId, query.noteId));

    return rows.map((row) => ({
      link: {
        id: row.id,
        sourceId: row.sourceId,
        targetSourceId: row.targetSourceId,
        targetFilename: row.targetFilename,
        linkType: row.linkType as SourceLink['linkType'],
        displayText: row.displayText,
        section: row.section,
        createdAt: row.createdAt,
      },
      sourceFilename: row.sourceFilename,
      sourceTitle: row.sourceTitle,
    }));
  }
}
