import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { ChatResponse, Message } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { Embedder } from '@delve/core';
import type { LlmProvider } from '@delve/core';
import { buildPrompt } from '@delve/core';
import { SendMessageCommand } from './send-message.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { conversations, messages, chunks, sources } from '../../database/schema';
import { toMessageResponse, toConversationResponse } from '../dto/conversation-response.dto';

/**
 * Row shape returned by the raw vector-search query.
 */
interface ChunkSearchRow {
  id: string;
  source_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  page_number: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  filename: string;
  file_type: string;
  score: number;
}

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  private readonly logger = new Logger(SendMessageHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
  ) {}

  async execute(command: SendMessageCommand): Promise<ChatResponse> {
    const { message: userMessage, model } = command;
    let { conversationId } = command;

    // --- Step 1: Resolve or create the conversation ---
    let conversationTitle = userMessage.slice(0, 80).trim();
    if (conversationTitle.length === 0) conversationTitle = 'New conversation';

    if (conversationId === undefined) {
      const [inserted] = await this.db
        .insert(conversations)
        .values({ title: conversationTitle })
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
          .values({ title: conversationTitle })
          .returning();

        if (inserted === undefined) {
          throw new InternalServerErrorException('Failed to create conversation');
        }
        conversationId = inserted.id;
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

    // --- Step 4: Embed the user query ---
    const embeddingResult = await this.embedder.embed(userMessage);
    if (!embeddingResult.ok) {
      this.logger.warn(`Embedding failed: ${embeddingResult.error}`);
    }

    // --- Step 5: Vector search for relevant chunks ---
    const topK = DEFAULT_CONFIG.topKResults;
    let chunkResults: ChunkSearchRow[] = [];

    if (embeddingResult.ok) {
      const embedding = embeddingResult.value;
      const vectorLiteral = `[${[...embedding].join(',')}]`;

      // Raw SQL for pgvector cosine distance operator <=>
      const rawRows = await this.db.execute(
        sql`
          SELECT
            c.id,
            c.source_id,
            c.chunk_index,
            c.content,
            c.token_count,
            c.page_number,
            c.metadata,
            c.created_at,
            s.filename,
            s.file_type,
            1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
          FROM chunks c
          JOIN sources s ON c.source_id = s.id
          WHERE s.status = 'ready'
            AND c.embedding IS NOT NULL
          ORDER BY c.embedding <=> ${vectorLiteral}::vector
          LIMIT ${topK}
        `,
      );

      chunkResults = rawRows as unknown as ChunkSearchRow[];
    }

    // Map to ChunkSearchResult for the prompt builder
    const contextResults = chunkResults
      .filter((r) => (r.score ?? 0) >= DEFAULT_CONFIG.similarityThreshold)
      .map((r) => ({
        chunk: {
          id: r.id,
          sourceId: r.source_id,
          chunkIndex: r.chunk_index,
          content: r.content,
          tokenCount: r.token_count,
          pageNumber: r.page_number ?? undefined,
          metadata: r.metadata,
          createdAt: r.created_at,
        },
        score: r.score,
        source: {
          id: r.source_id,
          filename: r.filename,
          fileType: r.file_type,
        },
      }));

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

    return {
      conversationId,
      message: toMessageResponse(savedAssistantMsg),
    };
  }
}
