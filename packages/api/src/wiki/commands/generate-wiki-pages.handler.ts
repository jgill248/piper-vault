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
import { ProviderAvailabilityService } from '../services/provider-availability.service';

/**
 * Outcome of a wiki generation run for a single source. Returned so callers
 * (the initialize flow, the ingest event listener) can report honest
 * success/failure counts instead of treating every run as processed.
 */
export interface WikiGenerationOutcome {
  readonly status: 'generated' | 'skipped' | 'failed';
  readonly pagesCreated: number;
  readonly pagesSynthesized: number;
  readonly error?: string;
}

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
    private readonly providerAvailability: ProviderAvailabilityService,
  ) {}

  async execute(command: GenerateWikiPagesCommand): Promise<WikiGenerationOutcome> {
    const { sourceId, collectionId } = command;
    const cfg = this.configStore.get();

    if (!cfg.wikiEnabled || (!cfg.wikiAutoIngest && !command.force)) {
      this.logger.debug('Wiki auto-ingest disabled, skipping');
      return { status: 'skipped', pagesCreated: 0, pagesSynthesized: 0 };
    }

    // ── Provider availability check ──────────────────────────────────────
    // Probe before running any expensive work. The service caches results and
    // backs off after repeated failures, emitting at most one log warning per
    // failure window instead of a stack trace per upload.
    const providerReachable = await this.providerAvailability.isAvailable();
    if (!providerReachable) {
      // Log the skip in wiki_log so the UI can surface it (operation 'skipped')
      await this.logProviderSkip(sourceId, collectionId);
      return { status: 'skipped', pagesCreated: 0, pagesSynthesized: 0 };
    }

    // ── Step 1: Load source content ──────────────────────────────────────
    const sourceContent = await this.loadSourceContent(sourceId);
    if (!sourceContent) {
      return { status: 'skipped', pagesCreated: 0, pagesSynthesized: 0 };
    }

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
      const error = `Embedding failed: ${sourceEmbeddingResult.error}`;
      await this.logFailure(sourceId, collectionId, sourceFilename, error);
      return { status: 'failed', pagesCreated: 0, pagesSynthesized: 0, error };
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
        await this.snapshotVersion(page.id, collectionId, page.content, 'synthesis', result.value.summary, sourceId);

        // Update the page with synthesized content (automated — do not set userReviewed)
        await this.commandBus.execute(
          new UpdateNoteCommand(page.id, result.value.content, undefined, undefined, undefined, false),
        );

        // Accumulate source IDs
        await this.db
          .update(sources)
          .set({ generationSourceIds: result.value.mergedSourceIds as string[] })
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
      // Record only a failure entry (no 'ingest' row) so the source stays
      // eligible for a retry on the next initialization run.
      await this.logFailure(sourceId, collectionId, sourceFilename, genResult.error, synthesizedIds.length);
      return {
        status: 'failed',
        pagesCreated: 0,
        pagesSynthesized: synthesizedIds.length,
        error: genResult.error,
      };
    }

    const { pages, summary } = genResult.value;

    // ── Step 7 + 8: Dedup and create new pages ───────────────────────────
    // Refresh page embeddings to include just-synthesized pages
    const refreshedPages = await this.loadExistingWikiPages(collectionId);
    const refreshedEmbeddings = await this.computePageEmbeddings(refreshedPages);

    // Pre-fetch all user-authored note titles in this collection so we can
    // detect title collisions before inserting a wiki-generated page.
    const userAuthoredTitles = await this.loadUserAuthoredTitles(collectionId);

    for (const page of pages) {
      // ── Collision guard: skip if a user-authored note has the same title ──
      // Prefer the user's version; log the skip so the UI can surface it.
      if (userAuthoredTitles.has(page.title.toLowerCase())) {
        this.logger.debug(
          `Wiki collision: user-authored note with title "${page.title}" already exists in collection — skipping wiki generation for this title`,
        );
        await this.logCollision(page.title, sourceId, collectionId, sourceFilename);
        continue;
      }

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
                await this.snapshotVersion(target.id, collectionId, target.content, 'synthesis', synthResult.value.summary, sourceId);
                await this.commandBus.execute(
                  new UpdateNoteCommand(target.id, synthResult.value.content, undefined, undefined, undefined, false),
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
    // Always log on success — even a zero-page run must be recorded, or the
    // initialize flow would treat the source as unprocessed and re-run it
    // on every initialization.
    await this.logOperation(
      synthesizedIds,
      createdIds,
      sourceId,
      collectionId,
      sourceFilename,
      summary || `No wiki-worthy content found in "${sourceFilename}"`,
    );

    return {
      status: 'generated',
      pagesCreated: createdIds.length,
      pagesSynthesized: synthesizedIds.length,
    };
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

  /**
   * Returns a Set of lowercased titles for all user-authored (non-generated)
   * notes in the collection. Used for title collision detection before creating
   * a wiki-generated page.
   */
  private async loadUserAuthoredTitles(collectionId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ title: sources.title })
      .from(sources)
      .where(
        and(
          eq(sources.collectionId, collectionId),
          eq(sources.isNote, true),
          eq(sources.isGenerated, false),
          eq(sources.status, 'ready'),
        ),
      );
    const set = new Set<string>();
    for (const row of rows) {
      if (row.title) set.add(row.title.toLowerCase());
    }
    return set;
  }

  /**
   * Records a collision-skip in wiki_log so the UI (Wiki Log) can surface it.
   * Uses operation 'collision' — distinct from 'ingest' so it doesn't mark the
   * source as processed, and distinct from 'error' so it isn't treated as a
   * failure requiring retry.
   */
  private async logCollision(
    pageTitle: string,
    sourceId: string,
    collectionId: string,
    sourceFilename: string,
  ): Promise<void> {
    try {
      await this.db.insert(wikiLog).values({
        operation: 'collision',
        summary: `Wiki generation skipped for "${pageTitle}": a user-authored note with this title already exists`,
        affectedSourceIds: [],
        sourceTriggerIds: sourceId,
        collectionId,
        metadata: { pageTitle, sourceFilename },
      });
    } catch (logErr) {
      const message = logErr instanceof Error ? logErr.message : String(logErr);
      this.logger.warn(`Failed to record wiki collision for "${pageTitle}": ${message}`);
    }
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
    collectionId: string,
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
      collectionId,
    });
  }

  /**
   * Records a provider-unavailable skip in wiki_log so the UI can surface it.
   * Uses operation 'skipped' — intentionally distinct from 'error' so it does
   * not trigger retry logic, and from 'ingest' so the source stays eligible for
   * the next initialization run.
   */
  private async logProviderSkip(
    sourceId: string,
    collectionId: string,
  ): Promise<void> {
    try {
      await this.db.insert(wikiLog).values({
        operation: 'skipped',
        summary: 'Wiki generation skipped: LLM provider is unreachable',
        affectedSourceIds: [],
        sourceTriggerIds: sourceId,
        collectionId,
        metadata: { reason: 'provider_unavailable' },
      });
    } catch (logErr) {
      const message = logErr instanceof Error ? logErr.message : String(logErr);
      this.logger.warn(`Failed to record provider-skip wiki log for ${sourceId}: ${message}`);
    }
  }

  /**
   * Records a failed generation run in wiki_log under the 'error' operation so
   * the failure is visible in the Wiki Log UI instead of only in server logs.
   * Uses a distinct operation (not 'ingest') so the source remains eligible
   * for retry on the next initialization run.
   */
  private async logFailure(
    sourceId: string,
    collectionId: string,
    sourceFilename: string,
    error: string,
    pagesSynthesized = 0,
  ): Promise<void> {
    try {
      await this.db.insert(wikiLog).values({
        operation: 'error',
        summary: `Wiki generation failed for "${sourceFilename}": ${error}`,
        affectedSourceIds: [],
        sourceTriggerIds: sourceId,
        collectionId,
        metadata: { error, sourceFilename, pagesSynthesized },
      });
    } catch (logErr) {
      const message = logErr instanceof Error ? logErr.message : String(logErr);
      this.logger.warn(`Failed to record wiki generation failure for ${sourceId}: ${message}`);
    }
  }

  private async logOperation(
    synthesizedIds: string[],
    createdIds: string[],
    sourceId: string,
    collectionId: string,
    sourceFilename: string,
    summary: string,
  ): Promise<void> {
    const allAffectedIds = [...new Set([...synthesizedIds, ...createdIds])];
    await this.db.insert(wikiLog).values({
      operation: 'ingest',
      summary,
      affectedSourceIds: allAffectedIds,
      sourceTriggerIds: sourceId,
      collectionId,
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
