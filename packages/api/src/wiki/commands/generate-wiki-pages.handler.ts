import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { LlmProvider } from '@delve/core';
import { generateWikiPages } from '@delve/core';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, wikiLog } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';
import { CreateNoteCommand } from '../../notes/commands/create-note.command';
import { UpdateNoteCommand } from '../../notes/commands/update-note.command';

@CommandHandler(GenerateWikiPagesCommand)
export class GenerateWikiPagesHandler implements ICommandHandler<GenerateWikiPagesCommand> {
  private readonly logger = new Logger(GenerateWikiPagesHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
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

    // Load the source content
    const sourceRows = await this.db
      .select({ filename: sources.filename, content: sources.content })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);

    const source = sourceRows[0];
    if (!source) {
      this.logger.warn(`Source ${sourceId} not found for wiki generation`);
      return;
    }

    // For non-note sources, content might be null (it's stored in chunks).
    // Read chunks if content is null.
    let sourceContent = source.content ?? '';
    if (!sourceContent) {
      const { chunks } = await import('../../database/schema');
      const chunkRows = await this.db
        .select({ content: chunks.content, chunkIndex: chunks.chunkIndex })
        .from(chunks)
        .where(eq(chunks.sourceId, sourceId))
        .orderBy(chunks.chunkIndex);
      sourceContent = chunkRows.map((c) => c.content).join('\n\n');
    }

    if (!sourceContent.trim()) {
      this.logger.debug(`Source ${sourceId} has no content for wiki generation`);
      return;
    }

    // Get existing wiki page titles (with IDs) for cross-referencing and updates
    const existingPages = await this.db
      .select({ id: sources.id, title: sources.title, content: sources.content })
      .from(sources)
      .where(
        and(
          eq(sources.collectionId, collectionId),
          eq(sources.isNote, true),
          eq(sources.status, 'ready'),
        ),
      );
    const existingTitles = existingPages
      .map((p) => p.title)
      .filter((t): t is string => t !== null);

    // Generate wiki pages via LLM
    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const result = await generateWikiPages(
      this.llm,
      source.filename,
      sourceContent,
      existingTitles,
      cfg.wikiMaxPagesPerIngest,
      model,
    );

    if (!result.ok) {
      this.logger.error(`Wiki generation failed for source ${sourceId}: ${result.error}`);
      return;
    }

    const { pages, updatedPages, summary } = result.value;
    const createdIds: string[] = [];
    const updatedIds: string[] = [];

    // Create each generated wiki page as a note
    for (const page of pages) {
      try {
        const noteResult = await this.commandBus.execute(
          new CreateNoteCommand(
            page.title,
            page.content,
            collectionId,
            cfg.wikiParentPath,
            [...page.tags, 'wiki-generated'],
          ),
        );
        if (noteResult.ok) {
          createdIds.push(noteResult.value.sourceId);
          // Mark the note as generated
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

    // Apply updates to existing wiki pages
    for (const update of updatedPages) {
      const existing = existingPages.find(
        (p) => p.title?.toLowerCase() === update.title.toLowerCase(),
      );
      if (!existing) {
        this.logger.debug(`Update target "${update.title}" not found, skipping`);
        continue;
      }

      try {
        const existingContent = existing.content ?? '';
        const newContent = `${existingContent}\n\n---\n\n${update.appendContent}`;
        await this.commandBus.execute(
          new UpdateNoteCommand(existing.id, newContent),
        );
        updatedIds.push(existing.id);
        this.logger.debug(`Updated wiki page "${update.title}": ${update.reason}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to update wiki page "${update.title}": ${message}`);
      }
    }

    // Log the wiki operation
    const allAffectedIds = [...createdIds, ...updatedIds];
    if (allAffectedIds.length > 0) {
      await this.db.insert(wikiLog).values({
        operation: 'ingest',
        summary,
        affectedSourceIds: allAffectedIds,
        sourceTriggerIds: sourceId,
        metadata: {
          pagesGenerated: pages.length,
          pagesUpdated: updatedIds.length,
          sourceFilename: source.filename,
        },
      });
      this.logger.log(
        `Wiki generation: ${createdIds.length} created, ${updatedIds.length} updated from source ${sourceId}`,
      );
    }
  }
}
