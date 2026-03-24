import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { IngestionPipeline, Embedder } from '@delve/core';
import { extractFrontmatter } from '@delve/core';
import { CreateNoteCommand } from './create-note.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks } from '../../database/schema';
import { createHash } from 'crypto';

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

    // Compute content hash
    const contentHash = createHash('sha256').update(content).digest('hex');

    // Run ingestion pipeline on the body (frontmatter stripped)
    const buffer = Buffer.from(fm.body, 'utf-8');
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
      return { ok: false, error: ingestionResult.error };
    }

    const { chunks: textChunks } = ingestionResult.value;

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
          status: 'processing',
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

    // Mark as ready
    await this.db
      .update(sources)
      .set({ status: 'ready', chunkCount: textChunks.length, updatedAt: new Date() })
      .where(eq(sources.id, sourceId));

    this.logger.log(`Created note "${resolvedTitle}" → ${sourceId} (${textChunks.length} chunks)`);
    return { ok: true, value: { sourceId, chunkCount: textChunks.length } };
  }
}
