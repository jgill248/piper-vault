import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { IngestionPipeline, Embedder } from '@delve/core';
import { extractFrontmatter, parseWikiLinks } from '@delve/core';
import { UpdateNoteCommand } from './update-note.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks, sourceLinks } from '../../database/schema';
import { createHash } from 'crypto';

@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  private readonly logger = new Logger(UpdateNoteHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('INGESTION_PIPELINE') private readonly pipeline: IngestionPipeline,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
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

        // Generate embeddings
        const contents = textChunks.map((c) => c.content);
        const embeddingResult = await this.embedder.embedBatch(contents);

        if (!embeddingResult.ok) {
          await this.db
            .update(sources)
            .set({ status: 'error', updatedAt: new Date() })
            .where(eq(sources.id, noteId));
          return { ok: false, error: `Embedding failed: ${embeddingResult.error}` };
        }

        const embeddings = embeddingResult.value;

        // Insert new chunks
        const chunkRows = textChunks.map((chunk, index) => ({
          sourceId: noteId,
          chunkIndex: chunk.index,
          content: chunk.content,
          embedding: embeddings[index] !== undefined ? [...embeddings[index]] : undefined,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata as Record<string, unknown>,
        }));

        if (chunkRows.length > 0) {
          await this.db.insert(chunks).values(chunkRows);
        }

        updates['chunkCount'] = textChunks.length;
        updates['fileSize'] = buffer.byteLength;
        updates['status'] = 'ready';
      }

      // Re-parse and store wiki-links
      await this.db.delete(sourceLinks).where(eq(sourceLinks.sourceId, noteId));
      const wikiLinks = parseWikiLinks(content);
      if (wikiLinks.length > 0) {
        try {
          const linkRows = wikiLinks.map((link) => ({
            sourceId: noteId,
            targetFilename: link.targetFilename,
            linkType: link.linkType,
            displayText: link.displayText,
            section: link.section,
          }));
          await this.db.insert(sourceLinks).values(linkRows);

          // Resolve target_source_id where target exists
          const collectionId = note.collectionId;
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
                    eq(sourceLinks.sourceId, noteId),
                    eq(sourceLinks.targetFilename, link.targetFilename),
                  ),
                );
            }
          }

          this.logger.log(`Updated ${wikiLinks.length} wiki-links for note ${noteId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to store wiki-links for note ${noteId}: ${message}`);
        }
      }
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

    await this.db.update(sources).set(updates).where(eq(sources.id, noteId));

    // Backfill targetSourceId on any links pointing to this note's (possibly new) title.
    // Covers: (a) notes that linked to this title before it existed, (b) title renames
    // where other notes linked using the new title.
    if (content !== undefined || title !== undefined) {
      const resolvedTitle = (updates['title'] as string | undefined) ?? note.title;
      if (resolvedTitle) {
        try {
          const collectionSources = await this.db
            .select({ id: sources.id })
            .from(sources)
            .where(eq(sources.collectionId, note.collectionId));

          if (collectionSources.length > 0) {
            await this.db
              .update(sourceLinks)
              .set({ targetSourceId: noteId })
              .where(
                and(
                  eq(sourceLinks.targetFilename, resolvedTitle),
                  isNull(sourceLinks.targetSourceId),
                  inArray(
                    sourceLinks.sourceId,
                    collectionSources.map((s) => s.id),
                  ),
                ),
              );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to backfill incoming backlinks for note ${noteId}: ${message}`);
        }
      }
    }

    this.logger.log(`Updated note ${noteId}`);
    return { ok: true, value: undefined };
  }
}
