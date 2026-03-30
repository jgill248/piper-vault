import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import type { ChatResponse, Message } from '@delve/shared';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import type { LlmProvider, NoteMetadata } from '@delve/core';
import {
  buildPrompt,
  detectQueryIntent,
  formatNoteContext,
} from '@delve/core';
import { SendMessageCommand } from './send-message.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages, systemPromptPresets } from '../../database/schema';
import { toMessageResponse, enrichMessageFromContext } from '../dto/conversation-response.dto';
import { RetrievalService } from '../../search/services/retrieval.service';
import { ConfigStore } from '../../config/config.store';

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  private readonly logger = new Logger(SendMessageHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(RetrievalService) private readonly retrievalService: RetrievalService,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
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

    // --- Step 3.5: Detect query intent (temporal, metadata, or semantic) ---
    const intent = detectQueryIntent(userMessage);
    this.logger.debug(`Query intent: ${intent.type}, temporal: ${intent.dateLabel ?? 'none'}`);

    // --- Steps 4-5: Retrieve relevant context based on intent ---
    const cfg = this.configStore.get();
    let contextResults: import('@delve/shared').ChunkSearchResult[] = [];
    let noteContext: string | undefined;
    let noteSourceIds: string[] = [];
    const noteFilenames = new Map<string, string>();

    if (intent.type === 'metadata' && intent.temporal) {
      // Pure metadata query — skip semantic search, do note listing
      const notes = await this.retrievalService.searchNotesByMetadata({
        dateFrom: intent.temporal.dateFrom,
        dateTo: intent.temporal.dateTo,
        dateField: intent.dateField,
        collectionId: command.collectionId ?? collectionId,
        tags: command.tags,
      });
      const noteMeta: NoteMetadata[] = notes.map((n) => ({
        id: n.id,
        title: n.title,
        filename: n.filename,
        tags: n.tags,
        content: n.content,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
        parentPath: n.parent_path,
      }));
      noteContext = formatNoteContext(noteMeta, intent.dateLabel ?? 'the requested period');
      noteSourceIds = notes.map((n) => n.id);
      for (const n of notes) noteFilenames.set(n.id, n.filename);
    } else if (intent.type === 'hybrid' && intent.temporal) {
      // Hybrid — do semantic search WITH date filter, PLUS note metadata
      const [chunks, notes] = await Promise.all([
        this.retrievalService.search({
          query: intent.contentQuery ?? userMessage,
          topK: cfg.topKResults,
          threshold: cfg.similarityThreshold,
          sourceIds: command.sourceIds,
          fileTypes: command.fileTypes,
          tags: command.tags,
          dateFrom: intent.temporal.dateFrom,
          dateTo: intent.temporal.dateTo,
          collectionId: command.collectionId ?? collectionId,
        }),
        this.retrievalService.searchNotesByMetadata({
          dateFrom: intent.temporal.dateFrom,
          dateTo: intent.temporal.dateTo,
          dateField: intent.dateField,
          collectionId: command.collectionId ?? collectionId,
        }),
      ]);
      contextResults = chunks;
      if (notes.length > 0) {
        const noteMeta: NoteMetadata[] = notes.map((n) => ({
          id: n.id,
          title: n.title,
          filename: n.filename,
          tags: n.tags,
          content: n.content,
          createdAt: n.created_at,
          updatedAt: n.updated_at,
          parentPath: n.parent_path,
        }));
        noteContext = formatNoteContext(noteMeta, intent.dateLabel ?? 'the requested period');
        noteSourceIds = notes.map((n) => n.id);
        for (const n of notes) noteFilenames.set(n.id, n.filename);
      }
    } else {
      // Standard semantic search (existing behavior, unchanged)
      contextResults = await this.retrievalService.search({
        query: userMessage,
        topK: cfg.topKResults,
        threshold: cfg.similarityThreshold,
        sourceIds: command.sourceIds,
        fileTypes: command.fileTypes,
        tags: command.tags,
        dateFrom: command.dateFrom,
        dateTo: command.dateTo,
        collectionId: command.collectionId,
      });
    }

    // --- Step 6: Load active preset persona ---
    const appConfig = this.configStore.get();
    let persona: string | undefined;
    let presetModel: string | null = null;

    if (appConfig.activePresetId) {
      const presetRows = await this.db
        .select()
        .from(systemPromptPresets)
        .where(eq(systemPromptPresets.id, appConfig.activePresetId))
        .limit(1);

      const activePreset = presetRows[0];
      if (activePreset) {
        persona = activePreset.persona || undefined;
        presetModel = activePreset.model;
      }
    }

    // --- Step 7: Build the prompt ---
    const { prompt, systemPrompt } = buildPrompt(
      userMessage,
      contextResults,
      history,
      appConfig.maxConversationTurns,
      noteContext,
      persona,
    );

    // Model priority: explicit request > preset > app config
    const effectiveModel = model ?? presetModel ?? appConfig.llmModel;

    // --- Step 8: Call the LLM ---
    const llmResult = await this.llm.query({
      prompt,
      systemPrompt,
      model: effectiveModel,
    });

    let assistantContent: string;
    let usedModel: string | undefined;

    if (!llmResult.ok) {
      this.logger.error(`LLM query failed: ${llmResult.error}`);
      // Map known auth/config errors to actionable user messages.
      // Save as the assistant reply so the chat stays usable rather than
      // returning a 500 that clears the conversation state in the UI.
      const lowerError = llmResult.error.toLowerCase();
      if (
        lowerError.includes('token is invalid') ||
        lowerError.includes('invalid token') ||
        lowerError.includes('unauthorized') ||
        lowerError.includes('access denied')
      ) {
        assistantContent =
          'No LLM provider is configured or your API key is invalid. ' +
          'Go to Settings → LLM Provider to add your API key.';
      } else if (lowerError.includes('rate limit')) {
        assistantContent =
          'The LLM provider rate limit was exceeded. Please wait a moment and try again.';
      } else if (lowerError.includes('network error') || lowerError.includes('timeout')) {
        assistantContent =
          'Could not reach the LLM provider. Check your network connection and try again.';
      } else {
        assistantContent =
          'The LLM provider returned an error. Check your API key in Settings → LLM Provider.';
      }
      usedModel = undefined;
    } else {
      assistantContent = llmResult.value.content;
      usedModel = llmResult.value.model;
    }

    // Source IDs used in this response (unique source_ids from retrieved chunks + notes)
    const sourceIds = [
      ...new Set([
        ...contextResults.map((r) => r.source.id),
        ...noteSourceIds,
      ]),
    ];

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

    // Return immediately — skip follow-up generation to avoid adding latency.
    // Follow-up generation requires an additional LLM round-trip (up to 3s)
    // which can cause the Vite proxy to timeout on slower LLM providers.
    // TODO: Re-enable follow-ups via a background job or WebSocket push when
    // streaming support (Phase 6) is implemented.

    const baseMessage = toMessageResponse(savedAssistantMsg);
    return {
      conversationId,
      message: enrichMessageFromContext(baseMessage, contextResults, noteFilenames),
    };
  }
}
