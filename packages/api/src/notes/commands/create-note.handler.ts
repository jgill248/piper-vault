import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { IngestionPipeline } from '@delve/core';
import { extractFrontmatter, parseWikiLinks } from '@delve/core';
import { CreateNoteCommand } from './create-note.command';
import { SourceIngestedEvent } from '../../sources/events/source-ingested.event';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';
import { ChunkIndexingService } from '../../indexing/services/chunk-indexing.service';
import { WikiLinkIndexingService } from '../../indexing/services/wiki-link-indexing.service';
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
    private readonly chunkIndexing: ChunkIndexingService,
    private readonly wikiLinkIndexing: WikiLinkIndexingService,
    @Inject(EventBus) private readonly eventBus: EventBus,
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

      const indexResult = await this.chunkIndexing.embedAndStoreChunks(sourceId, textChunks);

      if (!indexResult.ok) {
        await this.db
          .update(sources)
          .set({ status: 'error', updatedAt: new Date() })
          .where(eq(sources.id, sourceId));
        return { ok: false, error: indexResult.error };
      }

      chunkCount = textChunks.length;
    }

    // Parse and store wiki-links
    const wikiLinks = parseWikiLinks(content);
    await this.wikiLinkIndexing.storeAndResolveOutgoingLinks(sourceId, collectionId, wikiLinks);

    // Mark as ready (if not already set for empty notes)
    if (!isEmpty) {
      await this.db
        .update(sources)
        .set({ status: 'ready', chunkCount, updatedAt: new Date() })
        .where(eq(sources.id, sourceId));
    }

    // Backfill targetSourceId on any pre-existing links pointing to this note's title.
    // This handles the case where another note already contained [[This Note]] before
    // this note was created, leaving targetSourceId = NULL.
    await this.wikiLinkIndexing.backfillIncomingLinks(sourceId, collectionId, resolvedTitle);

    this.logger.log(`Created note "${resolvedTitle}" → ${sourceId} (${chunkCount} chunks)`);

    // Trigger async wiki generation for user-created notes
    if (!command.skipWikiGeneration && !isEmpty) {
      this.eventBus.publish(new SourceIngestedEvent(sourceId, collectionId, resolvedTitle));
    }

    return { ok: true, value: { sourceId, chunkCount } };
  }
}
