import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import type { LlmProvider, WikiLintResult } from '@delve/core';
import { runStructuralLint, runSemanticLint } from '@delve/core';
import { RunWikiLintCommand } from './run-wiki-lint.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, sourceLinks, wikiLog } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';

@CommandHandler(RunWikiLintCommand)
export class RunWikiLintHandler implements ICommandHandler<RunWikiLintCommand> {
  private readonly logger = new Logger(RunWikiLintHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
  ) {}

  async execute(command: RunWikiLintCommand): Promise<Result<WikiLintResult, string>> {
    const cfg = this.configStore.get();
    if (!cfg.wikiEnabled) {
      return { ok: true, value: { issues: [], summary: 'Wiki disabled' } };
    }

    const collectionId = command.collectionId ?? DEFAULT_COLLECTION_ID;

    // Load all generated wiki pages
    const wikiPages = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        content: sources.content,
        filename: sources.filename,
        generationSourceIds: sources.generationSourceIds,
        updatedAt: sources.updatedAt,
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
      return { ok: true, value: { issues: [], summary: 'No generated wiki pages to lint' } };
    }

    // --- Structural checks ---

    // Broken links: source_links where target_source_id IS NULL and source is a wiki page
    const wikiPageIds = wikiPages.map((p) => p.id);
    const brokenLinkRows = await this.db
      .select({
        sourceTitle: sources.title,
        targetFilename: sourceLinks.targetFilename,
      })
      .from(sourceLinks)
      .innerJoin(sources, eq(sourceLinks.sourceId, sources.id))
      .where(
        and(
          isNull(sourceLinks.targetSourceId),
          eq(sources.isGenerated, true),
        ),
      );

    const brokenLinks = brokenLinkRows.map((r) => ({
      sourcePageTitle: r.sourceTitle ?? 'Unknown',
      targetFilename: r.targetFilename,
    }));

    // Orphaned pages: wiki pages with zero incoming links
    const pagesWithBacklinks = await this.db
      .select({ targetId: sourceLinks.targetSourceId })
      .from(sourceLinks)
      .where(sql`${sourceLinks.targetSourceId} IS NOT NULL`);

    const linkedIds = new Set(pagesWithBacklinks.map((r) => r.targetId));
    const orphanedPages = wikiPages
      .filter((p) => !linkedIds.has(p.id))
      .map((p) => ({ title: p.title ?? p.filename, sourceId: p.id }));

    // Stale pages: wiki pages whose source documents were updated after the wiki page
    const stalePages: { title: string; sourceId: string; reason: string }[] = [];
    for (const page of wikiPages) {
      const genSourceIds = page.generationSourceIds as string[];
      if (genSourceIds.length === 0) continue;

      for (const genId of genSourceIds) {
        const srcRows = await this.db
          .select({ updatedAt: sources.updatedAt })
          .from(sources)
          .where(eq(sources.id, genId))
          .limit(1);

        const src = srcRows[0];
        if (src && page.updatedAt && src.updatedAt > page.updatedAt) {
          stalePages.push({
            title: page.title ?? page.filename,
            sourceId: page.id,
            reason: `Source document was updated after this wiki page was generated`,
          });
          break;
        }
      }
    }

    const structuralIssues = runStructuralLint(brokenLinks, orphanedPages, stalePages);

    // --- Semantic checks (LLM-powered) ---
    const pagesForSemantic = wikiPages
      .filter((p) => p.content)
      .map((p) => ({ title: p.title ?? p.filename, content: p.content ?? '' }));

    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const semanticResult = await runSemanticLint(this.llm, pagesForSemantic, model);

    const semanticIssues = semanticResult.ok ? semanticResult.value : [];
    if (!semanticResult.ok) {
      this.logger.warn(`Semantic lint failed: ${semanticResult.error}`);
    }

    const allIssues = [...structuralIssues, ...semanticIssues];
    const summary = `Lint complete: ${allIssues.length} issue(s) found across ${wikiPages.length} wiki page(s)`;

    // Update last_lint_at on all wiki pages
    for (const page of wikiPages) {
      await this.db
        .update(sources)
        .set({ lastLintAt: new Date() })
        .where(eq(sources.id, page.id));
    }

    // Log the lint operation
    await this.db.insert(wikiLog).values({
      operation: 'lint',
      summary,
      affectedSourceIds: wikiPageIds,
      metadata: {
        totalIssues: allIssues.length,
        structuralIssues: structuralIssues.length,
        semanticIssues: semanticIssues.length,
      },
    });

    this.logger.log(summary);
    return { ok: true, value: { issues: allIssues, summary } };
  }
}
