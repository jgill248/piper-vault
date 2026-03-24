import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { IngestionPipeline } from '@delve/core';
import type { Embedder } from '@delve/core';
import { extractFrontmatter, parseWikiLinks } from '@delve/core';
import { IngestSourceCommand } from './ingest-source.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks, sourceLinks } from '../../database/schema';

export interface IngestSourceResult {
  readonly sourceId: string;
  readonly chunkCount: number;
}

@CommandHandler(IngestSourceCommand)
export class IngestSourceHandler implements ICommandHandler<IngestSourceCommand> {
  private readonly logger = new Logger(IngestSourceHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('INGESTION_PIPELINE') private readonly pipeline: IngestionPipeline,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
  ) {}

  async execute(command: IngestSourceCommand): Promise<Result<IngestSourceResult, string>> {
    const { buffer, filename, mimeType, fileSize, collectionId } = command;

    // --- Step 1: Run the ingestion pipeline (parse + chunk) ---
    const ingestionResult = await this.pipeline.ingest(buffer, filename, mimeType, {
      chunkSize: DEFAULT_CONFIG.chunkSize,
      chunkOverlap: DEFAULT_CONFIG.chunkOverlap,
    });

    if (!ingestionResult.ok) {
      this.logger.warn(`Ingestion pipeline failed for "${filename}": ${ingestionResult.error}`);
      return { ok: false, error: ingestionResult.error };
    }

    const { chunks: textChunks, contentHash, metadata } = ingestionResult.value;

    // --- Step 2: Check for duplicate content within the same collection ---
    const existing = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          eq(sources.contentHash, contentHash),
          eq(sources.collectionId, collectionId),
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0] !== undefined) {
      throw new ConflictException(
        `A source with the same content already exists (id: ${existing[0].id})`,
      );
    }

    // --- Step 2b: Extract frontmatter and wiki-links for markdown files ---
    const isMarkdown = mimeType === 'text/markdown' || filename.endsWith('.md');
    let frontmatterData: Record<string, unknown> = {};
    let frontmatterTags: readonly string[] = [];
    let frontmatterTitle: string | null = null;
    let wikiLinks: ReturnType<typeof parseWikiLinks> = [];

    if (isMarkdown) {
      const text = buffer.toString('utf-8');
      const fm = extractFrontmatter(text);
      frontmatterData = fm.frontmatter;
      frontmatterTags = fm.tags;
      frontmatterTitle = fm.title;
      wikiLinks = parseWikiLinks(text);
    }

    // --- Step 3: Insert source record with status 'processing' ---
    let sourceId: string;
    try {
      const [inserted] = await this.db
        .insert(sources)
        .values({
          filename,
          fileType: mimeType,
          fileSize,
          contentHash,
          collectionId,
          status: 'processing',
          chunkCount: 0,
          tags: frontmatterTags.length > 0 ? [...frontmatterTags] as string[] : [],
          metadata: metadata as Record<string, unknown>,
          title: frontmatterTitle,
          frontmatter: frontmatterData as Record<string, unknown>,
        })
        .returning({ id: sources.id });

      if (inserted === undefined) {
        throw new Error('Insert returned no rows');
      }
      sourceId = inserted.id;
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to insert source record: ${message}`);
      throw new InternalServerErrorException('Failed to create source record');
    }

    // --- Step 4: Generate embeddings for all chunks ---
    const contents = textChunks.map((c) => c.content);
    const embeddingResult = await this.embedder.embedBatch(contents);

    if (!embeddingResult.ok) {
      await this.db
        .update(sources)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(sources.id, sourceId));
      return { ok: false, error: `Embedding failed: ${embeddingResult.error}` };
    }

    const embeddings = embeddingResult.value;

    // --- Step 5: Insert chunks with embeddings ---
    try {
      const chunkRows = textChunks.map((chunk, index) => ({
        sourceId,
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding: embeddings[index] !== undefined ? [...embeddings[index]] : undefined,
        tokenCount: chunk.tokenCount,
        pageNumber: typeof chunk.metadata['pageNumber'] === 'number'
          ? chunk.metadata['pageNumber']
          : undefined,
        metadata: chunk.metadata as Record<string, unknown>,
      }));

      if (chunkRows.length > 0) {
        await this.db.insert(chunks).values(chunkRows);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to insert chunks for source ${sourceId}: ${message}`);
      await this.db
        .update(sources)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(sources.id, sourceId));
      return { ok: false, error: `Failed to store chunks: ${message}` };
    }

    // --- Step 5b: Store wiki-links in source_links table ---
    if (wikiLinks.length > 0) {
      try {
        const linkRows = wikiLinks.map((link) => ({
          sourceId,
          targetFilename: link.targetFilename,
          linkType: link.linkType,
          displayText: link.displayText,
          section: link.section,
        }));

        await this.db.insert(sourceLinks).values(linkRows);

        // Resolve target_source_id for links where target already exists
        for (const link of wikiLinks) {
          const targets = await this.db
            .select({ id: sources.id })
            .from(sources)
            .where(
              and(
                eq(sources.filename, `${link.targetFilename}.md`),
                eq(sources.collectionId, collectionId),
              ),
            )
            .limit(1);

          if (targets.length > 0 && targets[0] !== undefined) {
            await this.db
              .update(sourceLinks)
              .set({ targetSourceId: targets[0].id })
              .where(
                and(
                  eq(sourceLinks.sourceId, sourceId),
                  eq(sourceLinks.targetFilename, link.targetFilename),
                ),
              );
          }
        }

        // Re-resolve any unresolved links from OTHER sources that point to this file
        const filenameWithoutExt = filename.replace(/\.md$/, '');
        await this.db
          .update(sourceLinks)
          .set({ targetSourceId: sourceId })
          .where(
            and(
              eq(sourceLinks.targetFilename, filenameWithoutExt),
              isNull(sourceLinks.targetSourceId),
            ),
          );

        this.logger.log(`Stored ${wikiLinks.length} wiki-links for source ${sourceId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to store wiki-links for source ${sourceId}: ${message}`);
        // Non-fatal — don't fail the ingestion for link storage issues
      }
    }

    // --- Step 6: Mark source as ready ---
    await this.db
      .update(sources)
      .set({ status: 'ready', chunkCount: textChunks.length, updatedAt: new Date() })
      .where(eq(sources.id, sourceId));

    this.logger.log(
      `Ingested "${filename}" → source ${sourceId} (${textChunks.length} chunks)`,
    );

    return { ok: true, value: { sourceId, chunkCount: textChunks.length } };
  }
}
