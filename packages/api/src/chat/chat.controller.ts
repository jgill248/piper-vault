import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  Header,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ChatResponse, PaginatedResponse, Conversation, ConversationWithMessages } from '@delve/shared';
import { SendMessageCommand } from './commands/send-message.command';
import { DeleteConversationCommand } from './commands/delete-conversation.command';
import { ListConversationsQuery } from './queries/list-conversations.query';
import { GetConversationQuery } from './queries/get-conversation.query';
import { ExportConversationQuery } from './queries/export-conversation.query';
import { StreamChatService } from './services/stream-chat.service';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  conversationId: z.string().uuid().optional(),
  model: z.string().optional(),
  sourceIds: z.array(z.string().uuid()).optional(),
  fileTypes: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  collectionId: z.string().uuid().optional(),
});

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
    private readonly streamChatService: StreamChatService,
  ) {}

  /**
   * POST /api/v1/chat
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() body: unknown): Promise<ChatResponse> {
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { message, conversationId, model, sourceIds, fileTypes, tags, dateFrom, dateTo, collectionId } = parsed.data;
    return this.commandBus.execute(
      new SendMessageCommand(message, conversationId, model, sourceIds, fileTypes, tags, dateFrom, dateTo, collectionId),
    );
  }

  /**
   * POST /api/v1/chat/stream
   * Server-Sent Events endpoint for streaming LLM responses.
   */
  @Post('chat/stream')
  async streamMessage(
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      for await (const event of this.streamChatService.stream(parsed.data)) {
        const data = JSON.stringify(event);
        reply.raw.write(`data: ${data}\n\n`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Stream error: ${msg}`);
      const errorEvent = JSON.stringify({ type: 'error', message: msg });
      reply.raw.write(`data: ${errorEvent}\n\n`);
    }

    reply.raw.end();
  }

  /**
   * GET /api/v1/conversations
   */
  @Get('conversations')
  async listConversations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('collectionId') collectionId?: string,
  ): Promise<PaginatedResponse<Conversation>> {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedPageSize = pageSize !== undefined ? parseInt(pageSize, 10) : 20;

    return this.queryBus.execute(
      new ListConversationsQuery(
        isNaN(parsedPage) ? 1 : parsedPage,
        isNaN(parsedPageSize) ? 20 : Math.min(parsedPageSize, 100),
        collectionId,
      ),
    );
  }

  /**
   * GET /api/v1/conversations/:id
   */
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string): Promise<ConversationWithMessages> {
    return this.queryBus.execute(new GetConversationQuery(id));
  }

  /**
   * GET /api/v1/conversations/:id/export
   * Returns the conversation as a downloadable markdown document.
   */
  @Get('conversations/:id/export')
  @Header('Content-Type', 'text/markdown')
  async exportConversation(
    @Param('id') id: string,
    @Query('format') format?: string,
  ): Promise<string> {
    const resolvedFormat = format === 'wikilink' ? 'wikilink' : 'markdown';
    return this.queryBus.execute(new ExportConversationQuery(id, resolvedFormat));
  }

  /**
   * DELETE /api/v1/conversations/:id
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new DeleteConversationCommand(id));
  }
}
