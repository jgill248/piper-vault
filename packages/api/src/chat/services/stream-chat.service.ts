import { Injectable, Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import type { Message, ChatRequest } from '@delve/shared';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import type { LlmProvider, NoteMetadata } from '@delve/core';
import { buildPrompt, detectQueryIntent, formatNoteContext } from '@delve/core';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages, systemPromptPresets } from '../../database/schema';
import { toMessageResponse } from '../dto/conversation-response.dto';
import { RetrievalService } from '../../search/services/retrieval.service';
import { ConfigStore } from '../../config/config.store';

/**
 * SSE event types sent to the client during streaming.
 */
export type StreamEvent =
  | { type: 'meta'; conversationId: string; messageId: string }
  | { type: 'delta'; content: string }
  | { type: 'sources'; sourceIds: string[] }
  | { type: 'done'; model?: string; tokensUsed?: number }
  | { type: 'error'; message: string };

@Injectable()
export class StreamChatService {
  private readonly logger = new Logger(StreamChatService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(RetrievalService) private readonly retrievalService: RetrievalService,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
  ) {}

  /**
   * Yields SSE events for a streaming chat response.
   * Handles conversation creation, retrieval, LLM streaming, and persistence.
   */
  async *stream(input: ChatRequest): AsyncIterable<StreamEvent> {
    const userMessage = input.message;
    let conversationId = input.conversationId;

    // --- Step 1: Resolve or create conversation ---
    const trimmed = userMessage.trim();
    const conversationTitle =
      trimmed.length === 0
        ? 'New conversation'
        : trimmed.length > 80
          ? `${trimmed.slice(0, 80)}...`
          : trimmed;

    const collectionId = input.collectionId ?? DEFAULT_COLLECTION_ID;

    if (conversationId === undefined) {
      const [inserted] = await this.db
        .insert(conversations)
        .values({ title: conversationTitle, collectionId })
        .returning();
      if (!inserted) throw new InternalServerErrorException('Failed to create conversation');
      conversationId = inserted.id;
    } else {
      const existing = await this.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (existing.length === 0) {
        const [inserted] = await this.db
          .insert(conversations)
          .values({ title: conversationTitle, collectionId })
          .returning();
        if (!inserted) throw new InternalServerErrorException('Failed to create conversation');
        conversationId = inserted.id;
      } else {
        await this.db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }
    }

    // --- Step 2: Persist user message ---
    const [savedUserMsg] = await this.db
      .insert(messages)
      .values({ conversationId, role: 'user', content: userMessage })
      .returning();
    if (!savedUserMsg) throw new InternalServerErrorException('Failed to save user message');

    // --- Step 3: Load conversation history ---
    const historyRows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    const history: Message[] = historyRows
      .filter((r) => r.id !== savedUserMsg.id)
      .map(toMessageResponse);

    // --- Step 3.5: Detect query intent ---
    const intent = detectQueryIntent(userMessage);
    this.logger.debug(`Query intent: ${intent.type}, temporal: ${intent.dateLabel ?? 'none'}`);

    // --- Steps 4-5: Retrieve context ---
    const cfg = this.configStore.get();
    let contextResults: import('@delve/shared').ChunkSearchResult[] = [];
    let noteContext: string | undefined;
    let noteSourceIds: string[] = [];

    if (intent.type === 'metadata' && intent.temporal) {
      const notes = await this.retrievalService.searchNotesByMetadata({
        dateFrom: intent.temporal.dateFrom,
        dateTo: intent.temporal.dateTo,
        dateField: intent.dateField,
        collectionId: input.collectionId ?? collectionId,
        tags: input.tags as string[] | undefined,
      });
      const noteMeta: NoteMetadata[] = notes.map((n) => ({
        id: n.id, title: n.title, filename: n.filename, tags: n.tags,
        content: n.content, createdAt: n.created_at, updatedAt: n.updated_at,
        parentPath: n.parent_path,
      }));
      noteContext = formatNoteContext(noteMeta, intent.dateLabel ?? 'the requested period');
      noteSourceIds = notes.map((n) => n.id);
    } else if (intent.type === 'hybrid' && intent.temporal) {
      const [chunks, notes] = await Promise.all([
        this.retrievalService.search({
          query: intent.contentQuery ?? userMessage,
          topK: cfg.topKResults,
          threshold: cfg.similarityThreshold,
          sourceIds: input.sourceIds as string[] | undefined,
          fileTypes: input.fileTypes as string[] | undefined,
          tags: input.tags as string[] | undefined,
          dateFrom: intent.temporal.dateFrom,
          dateTo: intent.temporal.dateTo,
          collectionId: input.collectionId ?? collectionId,
        }),
        this.retrievalService.searchNotesByMetadata({
          dateFrom: intent.temporal.dateFrom,
          dateTo: intent.temporal.dateTo,
          dateField: intent.dateField,
          collectionId: input.collectionId ?? collectionId,
        }),
      ]);
      contextResults = chunks;
      if (notes.length > 0) {
        const noteMeta: NoteMetadata[] = notes.map((n) => ({
          id: n.id, title: n.title, filename: n.filename, tags: n.tags,
          content: n.content, createdAt: n.created_at, updatedAt: n.updated_at,
          parentPath: n.parent_path,
        }));
        noteContext = formatNoteContext(noteMeta, intent.dateLabel ?? 'the requested period');
        noteSourceIds = notes.map((n) => n.id);
      }
    } else {
      contextResults = await this.retrievalService.search({
        query: userMessage,
        topK: cfg.topKResults,
        threshold: cfg.similarityThreshold,
        sourceIds: input.sourceIds as string[] | undefined,
        fileTypes: input.fileTypes as string[] | undefined,
        tags: input.tags as string[] | undefined,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        collectionId: input.collectionId,
      });
    }

    const sourceIds = [
      ...new Set([
        ...contextResults.map((r) => r.source.id),
        ...noteSourceIds,
      ]),
    ];

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

    // --- Step 7: Build prompt ---
    const { prompt, systemPrompt } = buildPrompt(
      userMessage,
      contextResults,
      history,
      appConfig.maxConversationTurns,
      noteContext,
      persona,
    );

    // Model priority: explicit request > preset > app config
    const effectiveModel = input.model ?? presetModel ?? appConfig.llmModel;

    // Emit metadata event first so the client knows the conversation ID
    const placeholderMsgId = `stream-${Date.now()}`;
    yield { type: 'meta', conversationId, messageId: placeholderMsgId };

    // Emit sources early so the UI can show them while streaming
    if (sourceIds.length > 0) {
      yield { type: 'sources', sourceIds };
    }

    // --- Step 8: Stream LLM response ---
    let fullContent = '';
    let usedModel: string | undefined;
    let tokensUsed: number | undefined;

    try {
      for await (const chunk of this.llm.streamQuery({
        prompt,
        systemPrompt,
        model: effectiveModel,
      })) {
        if (chunk.delta) {
          fullContent += chunk.delta;
          yield { type: 'delta', content: chunk.delta };
        }
        if (chunk.done) {
          usedModel = chunk.model;
          tokensUsed = chunk.tokensUsed;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`LLM stream error: ${msg}`);
      if (!fullContent) {
        fullContent = 'The LLM provider returned an error. Check your API key in Settings → LLM Provider.';
        yield { type: 'delta', content: fullContent };
      }
    }

    // Handle empty response
    if (!fullContent) {
      fullContent = 'The LLM provider returned an empty response.';
      yield { type: 'delta', content: fullContent };
    }

    // --- Step 8: Persist assistant message ---
    const [savedAssistantMsg] = await this.db
      .insert(messages)
      .values({
        conversationId,
        role: 'assistant',
        content: fullContent,
        sources: sourceIds.length > 0 ? sourceIds : null,
        model: usedModel,
      })
      .returning();

    if (!savedAssistantMsg) {
      yield { type: 'error', message: 'Failed to save assistant message' };
      return;
    }

    yield { type: 'done', model: usedModel, tokensUsed };
  }
}
