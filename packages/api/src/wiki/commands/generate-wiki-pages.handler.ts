import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { LlmProvider, Embedder } from '@delve/core';
import { generateWikiPages, synthesizeWikiPage, findSimilarPages, averageEmbeddings } from '@delve/core';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks, wikiLog, wikiPageVersions } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';
import { CreateNoteCommand } from '../../notes/commands/create-note.command';
import { UpdateNoteCommand } from '../../notes/commands/update-note.command';

/** Similarity threshold for matching new source content to existing wiki pages. */
const SYNTHESIS_SIMILARITY_THRESHOLD = 0.35;
/** Similarity threshold for deduplication — new page draft vs existing pages. */
const DEDUP_SIMILARITY_THRESHOLD = 0.75;
/** Maximum number of existing pages to synthesize per source ingestion. */
const MAX_SYNTHESIS_TARGETS = 5;

@CommandHandler(GenerateWikiPagesCommand)
export class GenerateWikiPagesHandler implements ICommandHandler<GenerateWikiPagesCommand> {
  private readonly logger = new Logger(GenerateWikiPagesHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(CommandBus) private readonly commandBus: CommandBus,
  ) {}

  async execute(command: GenerateWikiPagesCommand): Promise<void> {
    const { sourceId, collectionId } = command;
    const cfg = this.configStore.get();

    if (!cfg.wikiEnabled || (!cfg.wikiAutoIngest && !command.force)) {
      this.logger.debug('Wiki auto-ingest disabled, skipping');
      return;
    }

    // ── Step 1: Load source content ──────────────────────────────────────
    const sourceContent = await this.loadSourceContent(sourceId);
    if (!sourceContent) return;

    const sourceRows = await this.db
      .select({ filename: sources.filename })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);
    const sourceFilename = sourceRows[0]?.filename ?? sourceId;

    // ── Step 2: Embed source content ─────────────────────────────────────
    const sourceEmbeddingResult = await this.embedder.embed(sourceContent);
    if (!sourceEmbeddingResult.ok) {
      this.logger.error(`Failed to embed source ${sourceId}: ${sourceEmbeddingResult.error}`);
      return;
    }
    const sourceEmbedding = sourceEmbeddingResult.value;

    // ── Step 3: Fetch existing wiki pages with embeddings ────────────────
    const existingPages = await this.loadExistingWikiPages(collectionId);
    const pageEmbeddings = await this.computePageEmbeddings(existingPages);
    const existingTitles = existingPages
      .map((p) => p.title)
      .filter((t): t is string => t !== null);

    // ── Step 4: Find topically relevant pages for synthesis ──────────────
    const relevantPages = findSimilarPages(
      [...sourceEmbedding],
      pageEmbeddings,
      SYNTHESIS_SIMILARITY_THRESHOLD,
      MAX_SYNTHESIS_TARGETS,
    );

    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const synthesizedIds: string[] = [];
    const createdIds: string[] = [];

    // ── Step 5: Synthesize relevant pages ─────────────────────────────────
    for (const match of relevantPages) {
      const page = existingPages.find((p) => p.id === match.pageId);
      if (!page || !page.content || page.userReviewed) {
        if (page?.userReviewed) {
          this.logger.debug(`Skipping user-reviewed page "${page.title}"`);
        }
        continue;
      }

      try {
        const existingSourceIds = Array.isArray(page.generationSourceIds)
          ? (page.generationSourceIds as string[])
          : [];

        const result = await synthesizeWikiPage(
          this.llm,
          page.content,
          existingSourceIds,
          sourceContent,
          sourceId,
          { pageTitle: page.title ?? 'Untitled', pageTags: Array.isArray(page.tags) ? (page.tags as string[]) : [] },
          model,
        );

        if (!result.ok) {
          this.logger.warn(`Synthesis failed for page "${page.title}": ${result.error}`);
          continue;
        }

        if (result.value.changeType === 'no_change') {
          this.logger.debug(`No changes needed for page "${page.title}"`);
          continue;
        }

        // Snapshot current version before rewriting
        await this.snapshotVersion(page.id, page.content, 'synthesis', result.value.summary, sourceId);

        // Update the page with synthesized content
        await this.commandBus.execute(
          new UpdateNoteCommand(page.id, result.value.content),
        );

        // Accumulate source IDs
        await this.db
          .update(sources)
          .set({
            generationSourceIds: result.value.mergedSourceIds as string[],
            userReviewed: false, // synthesis resets user review
          })
          .where(eq(sources.id, page.id));

        synthesizedIds.push(page.id);
        this.logger.debug(`Synthesized page "${page.title}": ${result.value.summary}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to synthesize page "${page.title}": ${message}`);
      }
    }

    // ── Step 6: Generate new pages from novel content ────────────────────
    const genResult = await generateWikiPages(
      this.llm,
      sourceFilename,
      sourceContent,
      existingTitles,
      cfg.wikiMaxPagesPerIngest,
      model,
    );

    if (!genResult.ok) {
      this.logger.error(`Wiki generation failed for source ${sourceId}: ${genResult.error}`);
      // Still log synthesis results even if new-page generation fails
      if (synthesizedIds.length > 0) {
        await this.logOperation(synthesizedIds, [], sourceId, sourceFilename,
          `Synthesized ${synthesizedIds.length} pages (new page generation failed)`);
      }
      return;
    }

    const { pages, summary } = genResult.value;

    // ── Step 7 + 8: Dedup and create new pages ───────────────────────────
    // Refresh page embeddings to include just-synthesized pages
    const refreshedPages = await this.loadExistingWikiPages(collectionId);
    const refreshedEmbeddings = await this.computePageEmbeddings(refreshedPages);

    for (const page of pages) {
      try {
        // Embed the draft page content for dedup check
        const draftEmbResult = await this.embedder.embed(`${page.title}\n\n${page.content}`);
        if (draftEmbResult.ok) {
          const duplicates = findSimilarPages(
            [...draftEmbResult.value],
            refreshedEmbeddings,
            DEDUP_SIMILARITY_THRESHOLD,
            1,
          );

          if (duplicates.length > 0) {
            // Merge into the existing page instead of creating a duplicate
            const target = refreshedPages.find((p) => p.id === duplicates[0]!.pageId);
            if (target && target.content && !target.userReviewed) {
              const existingSourceIds = Array.isArray(target.generationSourceIds)
                ? (target.generationSourceIds as string[])
                : [];

              const synthResult = await synthesizeWikiPage(
                this.llm,
                target.content,
                existingSourceIds,
                page.content, // use draft content as "new source"
                sourceId,
                { pageTitle: target.title ?? 'Untitled', pageTags: Array.isArray(target.tags) ? (target.tags as string[]) : [] },
                model,
              );

              if (synthResult.ok && synthResult.value.changeType !== 'no_change') {
                await this.snapshotVersion(target.id, target.content, 'synthesis', synthResult.value.summary, sourceId);
                await this.commandBus.execute(
                  new UpdateNoteCommand(target.id, synthResult.value.content),
                );
                await this.db
                  .update(sources)
                  .set({ generationSourceIds: synthResult.value.mergedSourceIds as string[] })
                  .where(eq(sources.id, target.id));
                synthesizedIds.push(target.id);
                this.logger.debug(`Dedup-merged "${page.title}" into "${target.title}"`);
              }
              continue; // skip creating this page
            }
          }
        }

        // No duplicate found — create the page
        const noteResult = await this.commandBus.execute(
          new CreateNoteCommand(
            page.title,
            page.content,
            collectionId,
            cfg.wikiParentPath,
            [...page.tags, 'wiki-generated'],
            true, // skipWikiGeneration — prevent recursive wiki generation
          ),
        );
        if (noteResult.ok) {
          createdIds.push(noteResult.value.sourceId);
          await this.db
            .update(sources)
            .set({
              isGenerated: true,
              generatedBy: 'ingest',
              generationSourceIds: [sourceId],
            })
            .where(eq(sources.id, noteResult.value.sourceId));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to create wiki page "${page.title}": ${message}`);
      }
    }

    // ── Step 9: Log the operation ────────────────────────────────────────
    const allAffectedIds = [...new Set([...synthesizedIds, ...createdIds])];
    if (allAffectedIds.length > 0) {
      await this.logOperation(synthesizedIds, createdIds, sourceId, sourceFilename, summary);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async loadSourceContent(sourceId: string): Promise<string | null> {
    const sourceRows = await this.db
      .select({ content: sources.content })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);

    const source = sourceRows[0];
    if (!source) {
      this.logger.warn(`Source ${sourceId} not found for wiki generation`);
      return null;
    }

    let content = source.content ?? '';
    if (!content) {
      const chunkRows = await this.db
        .select({ content: chunks.content, chunkIndex: chunks.chunkIndex })
        .from(chunks)
        .where(eq(chunks.sourceId, sourceId))
        .orderBy(chunks.chunkIndex);
      content = chunkRows.map((c) => c.content).join('\n\n');
    }

    if (!content.trim()) {
      this.logger.debug(`Source ${sourceId} has no content for wiki generation`);
      return null;
    }

    return content;
  }

  private async loadExistingWikiPages(collectionId: string) {
    return this.db
      .select({
        id: sources.id,
        title: sources.title,
        content: sources.content,
        tags: sources.tags,
        generationSourceIds: sources.generationSourceIds,
        userReviewed: sources.userReviewed,
        isGenerated: sources.isGenerated,
      })
      .from(sources)
      .where(
        and(
          eq(sources.collectionId, collectionId),
          eq(sources.isNote, true),
          eq(sources.isGenerated, true),
          eq(sources.status, 'ready'),
        ),
      );
  }

  private async computePageEmbeddings(
    pages: { id: string; title: string | null }[],
  ) {
    const result: { pageId: string; title: string; embedding: number[] }[] = [];

    for (const page of pages) {
      const chunkRows = await this.db
        .select({ embedding: chunks.embedding })
        .from(chunks)
        .where(eq(chunks.sourceId, page.id));

      const embeddings = chunkRows
        .map((r) => r.embedding)
        .filter((e): e is number[] => e !== null && e.length > 0);

      if (embeddings.length > 0) {
        const avg = averageEmbeddings(embeddings);
        result.push({
          pageId: page.id,
          title: page.title ?? 'Untitled',
          embedding: avg,
        });
      }
    }

    return result;
  }

  private async snapshotVersion(
    pageId: string,
    content: string,
    changeType: string,
    changeSummary: string,
    triggeredBy: string,
  ): Promise<void> {
    // Get next version number
    const latest = await this.db
      .select({ versionNumber: wikiPageVersions.versionNumber })
      .from(wikiPageVersions)
      .where(eq(wikiPageVersions.sourceId, pageId))
      .orderBy(sql`version_number DESC`)
      .limit(1);

    const nextVersion = (latest[0]?.versionNumber ?? 0) + 1;

    await this.db.insert(wikiPageVersions).values({
      sourceId: pageId,
      versionNumber: nextVersion,
      content,
      changeType,
      changeSummary,
      triggeredBy,
    });
  }

  private async logOperation(
    synthesizedIds: string[],
    createdIds: string[],
    sourceId: string,
    sourceFilename: string,
    summary: string,
  ): Promise<void> {
    const allAffectedIds = [...new Set([...synthesizedIds, ...createdIds])];
    await this.db.insert(wikiLog).values({
      operation: 'ingest',
      summary,
      affectedSourceIds: allAffectedIds,
      sourceTriggerIds: sourceId,
      metadata: {
        pagesGenerated: createdIds.length,
        pagesSynthesized: synthesizedIds.length,
        sourceFilename,
      },
    });
    this.logger.log(
      `Wiki generation: ${createdIds.length} created, ${synthesizedIds.length} synthesized from source ${sourceId}`,
    );
  }
}
