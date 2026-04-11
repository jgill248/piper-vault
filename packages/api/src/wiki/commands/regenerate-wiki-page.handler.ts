import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import type { LlmProvider } from '@delve/core';
import { synthesizeWikiPage } from '@delve/core';
import type { Result } from '@delve/shared';
import { RegenerateWikiPageCommand } from './regenerate-wiki-page.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks, wikiLog, wikiPageVersions } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';
import { UpdateNoteCommand } from '../../notes/commands/update-note.command';

export interface RegeneratePreviewResult {
  readonly currentContent: string;
  readonly proposedContent: string;
}

export interface RegenerateApplyResult {
  readonly applied: true;
}

export type RegenerateWikiPageResult = RegeneratePreviewResult | RegenerateApplyResult;

@CommandHandler(RegenerateWikiPageCommand)
export class RegenerateWikiPageHandler implements ICommandHandler<RegenerateWikiPageCommand> {
  private readonly logger = new Logger(RegenerateWikiPageHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(CommandBus) private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: RegenerateWikiPageCommand,
  ): Promise<Result<RegenerateWikiPageResult, string>> {
    const { pageId, preview } = command;

    // Load the page
    const pageRows = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, pageId))
      .limit(1);

    const page = pageRows[0];
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    if (!page.isGenerated) {
      throw new BadRequestException('Only generated wiki pages can be regenerated');
    }

    const currentContent = page.content ?? '';
    const sourceIds = Array.isArray(page.generationSourceIds)
      ? (page.generationSourceIds as string[])
      : [];

    if (sourceIds.length === 0) {
      return { ok: false, error: 'Page has no contributing sources to regenerate from' };
    }

    // Load all contributing sources
    const contributingSources = await this.db
      .select({ id: sources.id, filename: sources.filename, content: sources.content })
      .from(sources)
      .where(inArray(sources.id, sourceIds));

    // For sources without direct content, reconstruct from chunks
    const sourceContents: { id: string; filename: string; content: string }[] = [];
    for (const src of contributingSources) {
      let content = src.content ?? '';
      if (!content) {
        const chunkRows = await this.db
          .select({ content: chunks.content, chunkIndex: chunks.chunkIndex })
          .from(chunks)
          .where(eq(chunks.sourceId, src.id))
          .orderBy(chunks.chunkIndex);
        content = chunkRows.map((c) => c.content).join('\n\n');
      }
      if (content.trim()) {
        sourceContents.push({ id: src.id, filename: src.filename, content });
      }
    }

    if (sourceContents.length === 0) {
      return { ok: false, error: 'No content found in contributing sources' };
    }

    const cfg = this.configStore.get();
    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const pageTags = Array.isArray(page.tags) ? (page.tags as string[]) : [];
    const pageTitle = page.title ?? 'Untitled';

    // Sequentially synthesize each source to build up the page
    let synthesizedContent = '';
    const allSourceIds: string[] = [];

    for (const src of sourceContents) {
      allSourceIds.push(src.id);

      const result = await synthesizeWikiPage(
        this.llm,
        synthesizedContent,
        allSourceIds.slice(0, -1), // existing sources up to this point
        src.content,
        src.id,
        { pageTitle, pageTags },
        model,
      );

      if (!result.ok) {
        this.logger.warn(`Regeneration synthesis failed for source ${src.id}: ${result.error}`);
        continue;
      }

      synthesizedContent = result.value.content;
    }

    if (!synthesizedContent) {
      return { ok: false, error: 'Regeneration produced no content' };
    }

    if (preview) {
      return {
        ok: true,
        value: { currentContent, proposedContent: synthesizedContent },
      };
    }

    // Apply the regeneration

    // Snapshot current version
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
      content: currentContent,
      changeType: 'regenerate',
      changeSummary: `Regenerated from ${sourceContents.length} sources`,
    });

    // Update the page
    await this.commandBus.execute(
      new UpdateNoteCommand(pageId, synthesizedContent),
    );

    // Reset userReviewed since content is now AI-generated
    await this.db
      .update(sources)
      .set({
        userReviewed: false,
        generationSourceIds: [...new Set(allSourceIds)],
      })
      .where(eq(sources.id, pageId));

    // Log
    await this.db.insert(wikiLog).values({
      operation: 'regenerate',
      summary: `Regenerated "${pageTitle}" from ${sourceContents.length} sources`,
      affectedSourceIds: [pageId],
      metadata: {
        sourceCount: sourceContents.length,
        sourceIds: allSourceIds,
      },
    });

    this.logger.log(`Regenerated wiki page "${pageTitle}"`);

    return { ok: true, value: { applied: true } };
  }
}
