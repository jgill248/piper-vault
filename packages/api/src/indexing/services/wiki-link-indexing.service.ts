import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
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

      // Resolution is case-insensitive ([[note a]] resolves to "Note A.md"),
      // matching how wiki software treats link targets. An exact-case match
      // wins when several sources differ only by case.
      const distinctTargets = [...new Set(wikiLinks.map((l) => l.targetFilename))];
      const targetRows = await this.db
        .select({ id: sources.id, filename: sources.filename })
        .from(sources)
        .where(
          and(
            inArray(
              sql`LOWER(${sources.filename})`,
              distinctTargets.map((t) => `${t.toLowerCase()}.md`),
            ),
            eq(sources.collectionId, collectionId),
          ),
        );

      const idByExactFilename = new Map<string, string>();
      const idByLowerFilename = new Map<string, string>();
      for (const row of targetRows) {
        if (!idByExactFilename.has(row.filename)) {
          idByExactFilename.set(row.filename, row.id);
        }
        const lower = row.filename.toLowerCase();
        if (!idByLowerFilename.has(lower)) {
          idByLowerFilename.set(lower, row.id);
        }
      }

      for (const target of distinctTargets) {
        const targetId =
          idByExactFilename.get(`${target}.md`) ??
          idByLowerFilename.get(`${target.toLowerCase()}.md`);
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

      // Case-insensitive to mirror outgoing-link resolution.
      await this.db
        .update(sourceLinks)
        .set({ targetSourceId: sourceId })
        .where(
          and(
            eq(sql`LOWER(${sourceLinks.targetFilename})`, targetName.toLowerCase()),
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
