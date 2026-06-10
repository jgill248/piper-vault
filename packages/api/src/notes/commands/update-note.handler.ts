import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { IngestionPipeline } from '@delve/core';
import { extractFrontmatter, parseWikiLinks } from '@delve/core';
import { UpdateNoteCommand } from './update-note.command';
import { SourceIngestedEvent } from '../../sources/events/source-ingested.event';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks, sourceLinks } from '../../database/schema';
import { ChunkIndexingService } from '../../indexing/services/chunk-indexing.service';
import { WikiLinkIndexingService } from '../../indexing/services/wiki-link-indexing.service';
import { createHash } from 'crypto';

@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  private readonly logger = new Logger(UpdateNoteHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('INGESTION_PIPELINE') private readonly pipeline: IngestionPipeline,
    private readonly chunkIndexing: ChunkIndexingService,
    private readonly wikiLinkIndexing: WikiLinkIndexingService,
    @Inject(EventBus) private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateNoteCommand): Promise<Result<void, string>> {
    const { noteId, content, title, parentPath, tags } = command;

    // Verify note exists and is actually a note
    const existing = await this.db
      .select()
      .from(sources)
      .where(and(eq(sources.id, noteId), eq(sources.isNote, true)))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Note with id "${noteId}" not found`);
    }

    const note = existing[0]!;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (parentPath !== undefined) {
      updates['parentPath'] = parentPath;
    }

    // If content changed, re-chunk and re-embed
    if (content !== undefined) {
      const fm = extractFrontmatter(content);

      updates['content'] = content;
      updates['contentHash'] = createHash('sha256').update(content).digest('hex');
      updates['frontmatter'] = fm.frontmatter;

      // Merge tags: explicit tags override, plus frontmatter tags
      if (tags !== undefined) {
        updates['tags'] = [...new Set([...tags, ...fm.tags])] as string[];
      } else {
        const existingTags = Array.isArray(note.tags) ? (note.tags as string[]) : [];
        updates['tags'] = [...new Set([...existingTags, ...fm.tags])] as string[];
      }

      // Resolve title
      if (title !== undefined) {
        updates['title'] = title;
        updates['filename'] = `${title}.md`;
      } else if (fm.title) {
        updates['title'] = fm.title;
        updates['filename'] = `${fm.title}.md`;
      }

      // Delete old chunks
      await this.db.delete(chunks).where(eq(chunks.sourceId, noteId));

      const buffer = Buffer.from(fm.body, 'utf-8');
      const isEmpty = fm.body.trim().length === 0;

      if (isEmpty) {
        // Empty content — just clear chunks and mark ready with 0 chunks
        updates['chunkCount'] = 0;
        updates['fileSize'] = buffer.byteLength;
        updates['status'] = 'ready';
      } else {
        // Re-ingest body
        const ingestionResult = await this.pipeline.ingest(
          buffer,
          (updates['filename'] as string) ?? note.filename,
          'text/markdown',
          {
            chunkSize: DEFAULT_CONFIG.chunkSize,
            chunkOverlap: DEFAULT_CONFIG.chunkOverlap,
          },
        );

        if (!ingestionResult.ok) {
          await this.db
            .update(sources)
            .set({ status: 'error', updatedAt: new Date() })
            .where(eq(sources.id, noteId));
          return { ok: false, error: ingestionResult.error };
        }

        const { chunks: textChunks } = ingestionResult.value;

        const indexResult = await this.chunkIndexing.embedAndStoreChunks(noteId, textChunks);

        if (!indexResult.ok) {
          await this.db
            .update(sources)
            .set({ status: 'error', updatedAt: new Date() })
            .where(eq(sources.id, noteId));
          return { ok: false, error: indexResult.error };
        }

        updates['chunkCount'] = textChunks.length;
        updates['fileSize'] = buffer.byteLength;
        updates['status'] = 'ready';
      }

      // Re-parse and store wiki-links
      await this.db.delete(sourceLinks).where(eq(sourceLinks.sourceId, noteId));
      const wikiLinks = parseWikiLinks(content);
      await this.wikiLinkIndexing.storeAndResolveOutgoingLinks(
        noteId,
        note.collectionId,
        wikiLinks,
      );
    } else {
      // No content change — just update metadata fields
      if (title !== undefined) {
        updates['title'] = title;
        updates['filename'] = `${title}.md`;
      }
      if (tags !== undefined) {
        updates['tags'] = [...tags] as string[];
      }
    }

    // If a user edits a generated wiki page, mark it as user-reviewed
    // to protect it from silent overwrite by future auto-synthesis.
    // Automated synthesis passes userInitiated=false to skip this flag.
    if (content !== undefined && note.isGenerated && command.userInitiated) {
      updates['userReviewed'] = true;
    }

    await this.db.update(sources).set(updates).where(eq(sources.id, noteId));

    // Backfill targetSourceId on any links pointing to this note's (possibly new) title.
    // Covers: (a) notes that linked to this title before it existed, (b) title renames
    // where other notes linked using the new title.
    if (content !== undefined || title !== undefined) {
      const resolvedTitle = (updates['title'] as string | undefined) ?? note.title;
      if (resolvedTitle) {
        await this.wikiLinkIndexing.backfillIncomingLinks(noteId, note.collectionId, resolvedTitle);
      }
    }

    this.logger.log(`Updated note ${noteId}`);

    // Trigger async wiki generation for updated user-created notes
    if (content !== undefined && !note.isGenerated) {
      const resolvedTitle = (updates['title'] as string | undefined) ?? note.title ?? note.filename;
      this.eventBus.publish(new SourceIngestedEvent(noteId, note.collectionId, resolvedTitle));
    }

    return { ok: true, value: undefined };
  }
}
