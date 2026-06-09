import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { ParsedWikiLink } from '@delve/core';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, sourceLinks } from '../../database/schema';

/**
 * Shared wiki-link persistence and resolution used by source ingestion and
 * note create/update. Link storage failures are non-fatal by design: a
 * source/note must never fail to ingest because its graph edges couldn't
 * be recorded.
 */
@Injectable()
export class WikiLinkIndexingService {
  private readonly logger = new Logger(WikiLinkIndexingService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Inserts the parsed outgoing links for a source and resolves
   * target_source_id for targets that already exist in the same collection.
   * Resolution is batched: one SELECT for all targets, then one UPDATE per
   * distinct resolved target filename.
   */
  async storeAndResolveOutgoingLinks(
    sourceId: string,
    collectionId: string,
    wikiLinks: readonly ParsedWikiLink[],
  ): Promise<void> {
    if (wikiLinks.length === 0) return;

    try {
      const linkRows = wikiLinks.map((link) => ({
        sourceId,
        targetFilename: link.targetFilename,
        linkType: link.linkType,
        displayText: link.displayText,
        section: link.section,
      }));
      await this.db.insert(sourceLinks).values(linkRows);

      const distinctTargets = [...new Set(wikiLinks.map((l) => l.targetFilename))];
      const targetRows = await this.db
        .select({ id: sources.id, filename: sources.filename })
        .from(sources)
        .where(
          and(
            inArray(sources.filename, distinctTargets.map((t) => `${t}.md`)),
            eq(sources.collectionId, collectionId),
          ),
        );

      const idByFilename = new Map<string, string>();
      for (const row of targetRows) {
        if (!idByFilename.has(row.filename)) {
          idByFilename.set(row.filename, row.id);
        }
      }

      for (const target of distinctTargets) {
        const targetId = idByFilename.get(`${target}.md`);
        if (targetId === undefined) continue;
        await this.db
          .update(sourceLinks)
          .set({ targetSourceId: targetId })
          .where(
            and(
              eq(sourceLinks.sourceId, sourceId),
              eq(sourceLinks.targetFilename, target),
            ),
          );
      }

      this.logger.log(`Stored ${wikiLinks.length} wiki-links for source ${sourceId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to store wiki-links for source ${sourceId}: ${message}`);
    }
  }

  /**
   * Resolves pre-existing unresolved links (target_source_id IS NULL) in the
   * same collection that point at `targetName` — the case where other
   * sources contained [[targetName]] before this source existed.
   */
  async backfillIncomingLinks(
    sourceId: string,
    collectionId: string,
    targetName: string,
  ): Promise<void> {
    try {
      const collectionSources = await this.db
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.collectionId, collectionId));

      if (collectionSources.length === 0) return;

      await this.db
        .update(sourceLinks)
        .set({ targetSourceId: sourceId })
        .where(
          and(
            eq(sourceLinks.targetFilename, targetName),
            isNull(sourceLinks.targetSourceId),
            inArray(
              sourceLinks.sourceId,
              collectionSources.map((s) => s.id),
            ),
          ),
        );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to backfill incoming backlinks for source ${sourceId}: ${message}`);
    }
  }
}
