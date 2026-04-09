import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import type { LlmProvider, WikiIndex } from '@delve/core';
import { generateWikiIndex } from '@delve/core';
import { GetWikiIndexQuery } from './get-wiki-index.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';

@QueryHandler(GetWikiIndexQuery)
export class GetWikiIndexHandler implements IQueryHandler<GetWikiIndexQuery> {
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

    // Build page metadata with first-line summaries
    const pages = wikiPages.map((p) => ({
      title: p.title ?? 'Untitled',
      tags: (p.tags ?? []) as readonly string[],
      summary: (p.content ?? '').split('\n').find((l) => l.trim().length > 0)?.slice(0, 120) ?? '',
    }));

    const cfg = this.configStore.get();
    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const result = await generateWikiIndex(this.llm, pages, model);

    if (result.ok) {
      return result.value;
    }

    // Fallback: group by first tag
    const byTag = new Map<string, { title: string; summary: string }[]>();
    for (const page of pages) {
      const tag = page.tags[0] ?? 'Uncategorized';
      const list = byTag.get(tag) ?? [];
      list.push({ title: page.title, summary: page.summary });
      byTag.set(tag, list);
    }

    return {
      categories: [...byTag.entries()].map(([name, items]) => ({ name, pages: items })),
    };
  }
}
