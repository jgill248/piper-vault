import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { IngestionPipeline, Embedder } from '@delve/core';
import { extractFrontmatter, parseWikiLinks } from '@delve/core';
import { CreateNoteCommand } from './create-note.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks, sourceLinks } from '../../database/schema';
import { createHash, randomUUID } from 'crypto';

export interface CreateNoteResult {
  readonly sourceId: string;
  readonly chunkCount: number;
}

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  private readonly logger = new Logger(CreateNoteHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('INGESTION_PIPELINE') private readonly pipeline: IngestionPipeline,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
  ) {}

  async execute(command: CreateNoteCommand): Promise<Result<CreateNoteResult, string>> {
    const { title, content, collectionId, parentPath, tags } = command;

    // Extract frontmatter from note content
    const fm = extractFrontmatter(content);
    const allTags = [...new Set([...tags, ...fm.tags])];
    const resolvedTitle = title || fm.title || 'Untitled';

    // Compute content hash — append a UUID so notes always bypass the
    // (collection_id, content_hash) unique constraint. Dedup is intentionally
    // skipped for notes: users may create multiple notes with identical content.
    const contentHash = createHash('sha256').update(`${content}\0${randomUUID()}`).digest('hex');
    const buffer = Buffer.from(fm.body, 'utf-8');
    const isEmpty = fm.body.trim().length === 0;

    // Insert source record as a note
    let sourceId: string;
    try {
      const [inserted] = await this.db
        .insert(sources)
        .values({
          filename: `${resolvedTitle}.md`,
          fileType: 'text/markdown',
          fileSize: buffer.byteLength,
          contentHash,
          collectionId,
          status: isEmpty ? 'ready' : 'processing',
          chunkCount: 0,
          tags: allTags as string[],
          metadata: {},
          isNote: true,
          content,
          parentPath,
          title: resolvedTitle,
          frontmatter: fm.frontmatter as Record<string, unknown>,
        })
        .returning({ id: sources.id });

      if (inserted === undefined) {
        throw new Error('Insert returned no rows');
      }
      sourceId = inserted.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to insert note: ${message}`);
      throw new InternalServerErrorException('Failed to create note');
    }

    // Skip ingestion + embedding for empty notes (user will fill in content later)
    let chunkCount = 0;
    if (!isEmpty) {
      // Run ingestion pipeline on the body (frontmatter stripped)
      const ingestionResult = await this.pipeline.ingest(
        buffer,
        `${resolvedTitle}.md`,
        'text/markdown',
        {
          chunkSize: DEFAULT_CONFIG.chunkSize,
          chunkOverlap: DEFAULT_CONFIG.chunkOverlap,
        },
      );

      if (!ingestionResult.ok) {
        this.logger.warn(`Note ingestion failed for "${resolvedTitle}": ${ingestionResult.error}`);
        await this.db
          .update(sources)
          .set({ status: 'error', updatedAt: new Date() })
          .where(eq(sources.id, sourceId));
        return { ok: false, error: ingestionResult.error };
      }

      const { chunks: textChunks } = ingestionResult.value;

      // Generate embeddings
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

      // Insert chunks with embeddings
      try {
        const chunkRows = textChunks.map((chunk, index) => ({
          sourceId,
          chunkIndex: chunk.index,
          content: chunk.content,
          embedding: embeddings[index] !== undefined ? [...embeddings[index]] : undefined,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata as Record<string, unknown>,
        }));

        if (chunkRows.length > 0) {
          await this.db.insert(chunks).values(chunkRows);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to insert chunks for note ${sourceId}: ${message}`);
        await this.db
          .update(sources)
          .set({ status: 'error', updatedAt: new Date() })
          .where(eq(sources.id, sourceId));
        return { ok: false, error: `Failed to store chunks: ${message}` };
      }

      chunkCount = textChunks.length;
    }

    // Parse and store wiki-links
    const wikiLinks = parseWikiLinks(content);
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

        this.logger.log(`Stored ${wikiLinks.length} wiki-links for note ${sourceId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to store wiki-links for note ${sourceId}: ${message}`);
      }
    }

    // Mark as ready (if not already set for empty notes)
    if (!isEmpty) {
      await this.db
        .update(sources)
        .set({ status: 'ready', chunkCount, updatedAt: new Date() })
        .where(eq(sources.id, sourceId));
    }

    this.logger.log(`Created note "${resolvedTitle}" → ${sourceId} (${chunkCount} chunks)`);
    return { ok: true, value: { sourceId, chunkCount } };
  }
}
