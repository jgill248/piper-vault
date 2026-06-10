import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import type { ParsedWikiLink } from '@delve/core';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, sourceLinks } from '../../database/schema';

/**
 * When multiple sources share the same filename (title collision between a
 * user-authored note and a wiki-generated copy), resolveByPreference picks the
 * winner using a stable, deterministic rule:
 *   1. Prefer non-generated notes (is_generated = false) over generated ones.
 *   2. Among ties at the same generation status, prefer the most recently
 *      updated row (later updatedAt wins).
 */
export function resolveByPreference(
  rows: readonly { id: string; isGenerated: boolean; updatedAt: Date }[],
): string | undefined {
  if (rows.length === 0) return undefined;
  const sorted = [...rows].sort((a, b) => {
    // Non-generated notes rank first (false = 0, true = 1 so ascending sort)
    const genDiff = (a.isGenerated ? 1 : 0) - (b.isGenerated ? 1 : 0);
    if (genDiff !== 0) return genDiff;
    // Among equals, prefer the more recently updated
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return sorted[0]!.id;
}

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
      // wins when several sources differ only by case. When multiple sources
      // share the same filename (title collision), resolveByPreference picks
      // the user-authored note over any wiki-generated copy.
      const distinctTargets = [...new Set(wikiLinks.map((l) => l.targetFilename))];
      const targetRows = await this.db
        .select({
          id: sources.id,
          filename: sources.filename,
          isGenerated: sources.isGenerated,
          updatedAt: sources.updatedAt,
        })
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

      // Group all rows by exact filename, then by lower filename, so we can
      // apply the preference resolver when duplicates exist.
      const rowsByExactFilename = new Map<string, typeof targetRows>();
      const rowsByLowerFilename = new Map<string, typeof targetRows>();
      for (const row of targetRows) {
        const group = rowsByExactFilename.get(row.filename) ?? [];
        group.push(row);
        rowsByExactFilename.set(row.filename, group);

        const lower = row.filename.toLowerCase();
        const lowerGroup = rowsByLowerFilename.get(lower) ?? [];
        lowerGroup.push(row);
        rowsByLowerFilename.set(lower, lowerGroup);
      }

      for (const target of distinctTargets) {
        const candidates =
          rowsByExactFilename.get(`${target}.md`) ??
          rowsByLowerFilename.get(`${target.toLowerCase()}.md`);
        const targetId = resolveByPreference(candidates ?? []);
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
