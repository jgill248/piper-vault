import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { z } from 'zod';
import type { ChatResponse, PaginatedResponse, Conversation, ConversationWithMessages } from '@delve/shared';
import { SendMessageCommand } from './commands/send-message.command';
import { DeleteConversationCommand } from './commands/delete-conversation.command';
import { ListConversationsQuery } from './queries/list-conversations.query';
import { GetConversationQuery } from './queries/get-conversation.query';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  conversationId: z.string().uuid().optional(),
  model: z.string().optional(),
});

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
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

    const { message, conversationId, model } = parsed.data;
    return this.commandBus.execute(
      new SendMessageCommand(message, conversationId, model),
    );
  }

  /**
   * GET /api/v1/conversations
   */
  @Get('conversations')
  async listConversations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PaginatedResponse<Conversation>> {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedPageSize = pageSize !== undefined ? parseInt(pageSize, 10) : 20;

    return this.queryBus.execute(
      new ListConversationsQuery(
        isNaN(parsedPage) ? 1 : parsedPage,
        isNaN(parsedPageSize) ? 20 : Math.min(parsedPageSize, 100),
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
   * DELETE /api/v1/conversations/:id
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new DeleteConversationCommand(id));
  }
}
