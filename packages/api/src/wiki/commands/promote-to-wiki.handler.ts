import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import type { LlmProvider } from '@delve/core';
import { promoteConversationToWiki } from '@delve/core';
import { PromoteToWikiCommand } from './promote-to-wiki.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages, sources, wikiLog } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';
import { CreateNoteCommand } from '../../notes/commands/create-note.command';

export interface PromoteToWikiResult {
  readonly sourceId: string;
  readonly title: string;
}

@CommandHandler(PromoteToWikiCommand)
export class PromoteToWikiHandler implements ICommandHandler<PromoteToWikiCommand> {
  private readonly logger = new Logger(PromoteToWikiHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(CommandBus) private readonly commandBus: CommandBus,
  ) {}

  async execute(command: PromoteToWikiCommand): Promise<Result<PromoteToWikiResult, string>> {
    const { conversationId, collectionId } = command;
    const cfg = this.configStore.get();

    // Load conversation
    const convRows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convRows.length === 0) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // Load messages
    const msgRows = await this.db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    if (msgRows.length === 0) {
      return { ok: false, error: 'Conversation has no messages' };
    }

    // Get existing wiki page titles
    const existingPages = await this.db
      .select({ title: sources.title })
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

    // Promote via LLM
    const model = cfg.wikiGenerationModel || cfg.llmModel;
    const result = await promoteConversationToWiki(
      this.llm,
      msgRows,
      existingTitles,
      model,
    );

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const { title, content, tags, summary } = result.value;

    // Create the wiki page as a note
    const noteResult = await this.commandBus.execute(
      new CreateNoteCommand(
        title,
        content,
        collectionId,
        cfg.wikiParentPath,
        [...tags, 'wiki-generated', 'from-conversation'],
      ),
    );

    if (!noteResult.ok) {
      return { ok: false, error: `Failed to create wiki page: ${noteResult.error}` };
    }

    const sourceId = noteResult.value.sourceId;

    // Mark as generated
    await this.db
      .update(sources)
      .set({
        isGenerated: true,
        generatedBy: 'query',
        generationSourceIds: [],
      })
      .where(eq(sources.id, sourceId));

    // Log the operation
    await this.db.insert(wikiLog).values({
      operation: 'query',
      summary,
      affectedSourceIds: [sourceId],
      metadata: { conversationId, title },
    });

    this.logger.log(`Promoted conversation ${conversationId} to wiki page "${title}" (${sourceId})`);
    return { ok: true, value: { sourceId, title } };
  }
}
