import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import type { ChatResponse, Message } from '@delve/shared';
import { DEFAULT_CONFIG, DEFAULT_COLLECTION_ID } from '@delve/shared';
import type { LlmProvider } from '@delve/core';
import { buildPrompt, generateFollowUpQuestions } from '@delve/core';
import { SendMessageCommand } from './send-message.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages } from '../../database/schema';
import { toMessageResponse } from '../dto/conversation-response.dto';
import { RetrievalService } from '../../search/services/retrieval.service';
import { ConfigStore } from '../../config/config.store';

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  private readonly logger = new Logger(SendMessageHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    private readonly retrievalService: RetrievalService,
    private readonly configStore: ConfigStore,
  ) {}

  async execute(command: SendMessageCommand): Promise<ChatResponse> {
    const { message: userMessage, model } = command;
    let { conversationId } = command;

    // --- Step 1: Resolve or create the conversation ---
    const trimmed = userMessage.trim();
    const conversationTitle =
      trimmed.length === 0
        ? 'New conversation'
        : trimmed.length > 80
          ? `${trimmed.slice(0, 80)}...`
          : trimmed;

    const collectionId = command.collectionId ?? DEFAULT_COLLECTION_ID;

    if (conversationId === undefined) {
      const [inserted] = await this.db
        .insert(conversations)
        .values({ title: conversationTitle, collectionId })
        .returning();

      if (inserted === undefined) {
        throw new InternalServerErrorException('Failed to create conversation');
      }
      conversationId = inserted.id;
    } else {
      // Verify it exists
      const existing = await this.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (existing.length === 0) {
        // Create a new conversation with the provided id is not possible with
        // auto-generated PKs; create fresh and ignore the supplied id.
        const [inserted] = await this.db
          .insert(conversations)
          .values({ title: conversationTitle, collectionId })
          .returning();

        if (inserted === undefined) {
          throw new InternalServerErrorException('Failed to create conversation');
        }
        conversationId = inserted.id;
      } else {
        // Touch updatedAt so list ordering reflects last activity.
        await this.db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }
    }

    // --- Step 2: Persist the user message ---
    const [savedUserMsg] = await this.db
      .insert(messages)
      .values({
        conversationId,
        role: 'user',
        content: userMessage,
      })
      .returning();

    if (savedUserMsg === undefined) {
      throw new InternalServerErrorException('Failed to save user message');
    }

    // --- Step 3: Load prior conversation history for context ---
    const historyRows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    // Exclude the just-inserted user message from history (it's the current query)
    const history: Message[] = historyRows
      .filter((r) => r.id !== savedUserMsg.id)
      .map(toMessageResponse);

    // --- Steps 4-5: Retrieve relevant chunks via hybrid search + re-ranking ---
    const contextResults = await this.retrievalService.search({
      query: userMessage,
      topK: DEFAULT_CONFIG.topKResults,
      threshold: DEFAULT_CONFIG.similarityThreshold,
      sourceIds: command.sourceIds,
      fileTypes: command.fileTypes,
      tags: command.tags,
      dateFrom: command.dateFrom,
      dateTo: command.dateTo,
      collectionId: command.collectionId,
    });

    // --- Step 6: Build the prompt ---
    const { prompt, systemPrompt } = buildPrompt(
      userMessage,
      contextResults,
      history,
      DEFAULT_CONFIG.maxConversationTurns,
    );

    // --- Step 7: Call the LLM ---
    const llmResult = await this.llm.query({
      prompt,
      systemPrompt,
      model: model ?? DEFAULT_CONFIG.llmModel,
    });

    if (!llmResult.ok) {
      this.logger.error(`LLM query failed: ${llmResult.error}`);
      throw new InternalServerErrorException('LLM query failed');
    }

    const { content: assistantContent, model: usedModel } = llmResult.value;

    // Source IDs used in this response (unique source_ids from retrieved chunks)
    const sourceIds = [...new Set(contextResults.map((r) => r.source.id))];

    // --- Step 8: Persist the assistant message ---
    const [savedAssistantMsg] = await this.db
      .insert(messages)
      .values({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        sources: sourceIds.length > 0 ? sourceIds : null,
        model: usedModel,
      })
      .returning();

    if (savedAssistantMsg === undefined) {
      throw new InternalServerErrorException('Failed to save assistant message');
    }

    // Generate follow-up questions if enabled (capped at 3s to avoid blocking the response)
    let suggestedFollowUps: string[] | undefined;
    const config = this.configStore.get();
    if (config.followUpQuestionsEnabled && contextResults.length > 0) {
      const FOLLOW_UP_TIMEOUT_MS = 3000;
      try {
        suggestedFollowUps = await Promise.race([
          generateFollowUpQuestions(
            this.llm,
            userMessage,
            assistantContent,
            contextResults,
          ),
          new Promise<string[]>((_, reject) =>
            setTimeout(() => reject(new Error('Follow-up generation timed out')), FOLLOW_UP_TIMEOUT_MS),
          ),
        ]);
      } catch (err) {
        this.logger.warn(`Follow-up generation skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      conversationId,
      message: toMessageResponse(savedAssistantMsg),
      ...(suggestedFollowUps && suggestedFollowUps.length > 0 ? { suggestedFollowUps } : {}),
    };
  }
}
