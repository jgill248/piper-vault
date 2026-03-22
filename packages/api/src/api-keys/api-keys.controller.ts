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
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { ApiKey, ApiKeyCreatedResponse } from '@delve/shared';
import { CreateApiKeyCommand } from './commands/create-api-key.command';
import { RevokeApiKeyCommand } from './commands/revoke-api-key.command';
import { ListApiKeysQuery } from './queries/list-api-keys.query';
import { CreateApiKeySchema } from './dto/create-api-key.dto';

@Controller('api-keys')
export class ApiKeysController {
  private readonly logger = new Logger(ApiKeysController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /api/v1/api-keys
   * Creates a new API key. Returns the full key ONCE — store it securely.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<ApiKeyCreatedResponse> {
    const parsed = CreateApiKeySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { name, collectionId, expiresAt } = parsed.data;
    const expiresAtDate = expiresAt !== undefined ? new Date(expiresAt) : undefined;

    return this.commandBus.execute<CreateApiKeyCommand, ApiKeyCreatedResponse>(
      new CreateApiKeyCommand(name, collectionId, expiresAtDate),
    );
  }

  /**
   * GET /api/v1/api-keys
   * Lists API keys. Optionally filter by collectionId.
   * Never returns the full key or hash — only prefix.
   */
  @Get()
  async list(@Query('collectionId') collectionId?: string): Promise<ApiKey[]> {
    return this.queryBus.execute<ListApiKeysQuery, ApiKey[]>(
      new ListApiKeysQuery(collectionId),
    );
  }

  /**
   * DELETE /api/v1/api-keys/:id
   * Revokes (deletes) an API key.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new RevokeApiKeyCommand(id));
  }
}
