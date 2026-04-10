import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import type { LlmProvider, WikiIndex, WikiIndexCategory, RawWikiIndex } from '@delve/core';
import { generateWikiIndex } from '@delve/core';
import { GetWikiIndexQuery } from './get-wiki-index.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, wikiLog } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';

/** Operations that invalidate the cached index. */
const INVALIDATING_OPS = ['ingest', 'initialize', 'promote', 'update'];

@QueryHandler(GetWikiIndexQuery)
export class GetWikiIndexHandler implements IQueryHandler<GetWikiIndexQuery> {
  private readonly logger = new Logger(GetWikiIndexHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
  ) {}

  async execute(query: GetWikiIndexQuery): Promise<WikiIndex> {
    const collectionId = query.collectionId ?? DEFAULT_COLLECTION_ID;

    // Load all generated wiki pages
    const wikiPages = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        tags: sources.tags,
        content: sources.content,
      })
      .from(sources)
      .where(
        and(
          eq(sources.collectionId, collectionId),
          eq(sources.isGenerated, true),
          eq(sources.status, 'ready'),
        ),
      );

    if (wikiPages.length === 0) {
      return { categories: [] };
    }

    // Build title→id lookup (case-insensitive) for enriching index results
    const titleToId = new Map<string, string>();
    for (const p of wikiPages) {
      if (p.title) titleToId.set(p.title.toLowerCase(), p.id);
    }

    // Check for a cached index that's still valid
    const cached = await this.getCachedIndex(titleToId);
    if (cached) {
      this.logger.debug('Returning cached wiki index');
      return cached;
    }

    // Build page metadata with first-line summaries for LLM
    const pages = wikiPages.map((p) => ({
      title: p.title ?? 'Untitled',
      tags: (p.tags ?? []) as readonly string[],
      summary: (p.content ?? '').split('\n').find((l) => l.trim().length > 0)?.slice(0, 120) ?? '',
    }));

    const cfg = this.configStore.get();
    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const result = await generateWikiIndex(this.llm, pages, model);

    let index: WikiIndex;

    if (result.ok) {
      index = this.enrichWithIds(result.value, titleToId);
    } else {
      // Fallback: group by first tag
      index = this.buildFallbackIndex(pages, titleToId);
    }

    // Cache the generated index
    await this.cacheIndex(index);

    return index;
  }

  /**
   * Enrich LLM-generated index with page IDs by matching titles.
   */
  private enrichWithIds(
    raw: RawWikiIndex,
    titleToId: Map<string, string>,
  ): WikiIndex {
    return {
      categories: raw.categories.map((cat) => ({
        name: cat.name,
        pages: cat.pages.map((p) => ({
          id: titleToId.get(p.title.toLowerCase()) ?? '',
          title: p.title,
          summary: p.summary,
        })),
      })),
    };
  }

  /**
   * Group pages by first tag when LLM fails.
   */
  private buildFallbackIndex(
    pages: readonly { title: string; tags: readonly string[]; summary: string }[],
    titleToId: Map<string, string>,
  ): WikiIndex {
    const byTag = new Map<string, WikiIndexCategory['pages'][number][]>();
    for (const page of pages) {
      const tag = page.tags[0] ?? 'Uncategorized';
      const list = byTag.get(tag) ?? [];
      list.push({
        id: titleToId.get(page.title.toLowerCase()) ?? '',
        title: page.title,
        summary: page.summary,
      });
      byTag.set(tag, list);
    }
    return {
      categories: [...byTag.entries()].map(([name, items]) => ({ name, pages: items })),
    };
  }

  /**
   * Check for a cached 'index' entry in wikiLog that is newer than
   * the latest invalidating operation.
   */
  private async getCachedIndex(titleToId: Map<string, string>): Promise<WikiIndex | null> {
    // Find the most recent 'index' cache entry
    const cachedRows = await this.db
      .select({ metadata: wikiLog.metadata, createdAt: wikiLog.createdAt })
      .from(wikiLog)
      .where(eq(wikiLog.operation, 'index'))
      .orderBy(desc(wikiLog.createdAt))
      .limit(1);

    if (cachedRows.length === 0) return null;

    const cachedEntry = cachedRows[0]!;

    // Find the most recent invalidating operation
    const latestChange = await this.db
      .select({ createdAt: wikiLog.createdAt })
      .from(wikiLog)
      .where(inArray(wikiLog.operation, INVALIDATING_OPS))
      .orderBy(desc(wikiLog.createdAt))
      .limit(1);

    // If there's a change newer than the cache, invalidate
    if (latestChange.length > 0 && latestChange[0]!.createdAt > cachedEntry.createdAt) {
      return null;
    }

    // Validate and return cached index
    const meta = cachedEntry.metadata as Record<string, unknown> | null;
    if (!meta || !Array.isArray(meta.categories)) return null;

    const cached = meta as unknown as WikiIndex;

    // Re-enrich with current IDs in case pages were renamed
    return this.enrichWithIds(cached, titleToId);
  }

  /**
   * Store the generated index in wikiLog for caching.
   */
  private async cacheIndex(index: WikiIndex): Promise<void> {
    try {
      await this.db.insert(wikiLog).values({
        operation: 'index',
        summary: `Index generated: ${index.categories.length} categories`,
        affectedSourceIds: [],
        metadata: index as unknown as Record<string, unknown>,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to cache wiki index: ${message}`);
    }
  }
}
