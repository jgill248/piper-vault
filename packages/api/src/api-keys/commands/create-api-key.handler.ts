import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import type { ApiKeyCreatedResponse } from '@delve/shared';
import { CreateApiKeyCommand } from './create-api-key.command';
import { ApiKeyService } from '../../auth/api-key.service';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { apiKeys } from '../../database/schema';
import { toApiKeyResponse } from '../dto/api-key-response.dto';

@CommandHandler(CreateApiKeyCommand)
export class CreateApiKeyHandler implements ICommandHandler<CreateApiKeyCommand> {
  private readonly logger = new Logger(CreateApiKeyHandler.name);

  constructor(
    @Inject(ApiKeyService) private readonly apiKeyService: ApiKeyService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async execute(command: CreateApiKeyCommand): Promise<ApiKeyCreatedResponse> {
    const { name, collectionId, expiresAt } = command;
    const { key, keyHash, prefix } = this.apiKeyService.generateKey();

    const [inserted] = await this.db
      .insert(apiKeys)
      .values({
        name,
        keyHash,
        prefix,
        collectionId,
        permissions: {},
        expiresAt: expiresAt ?? null,
      })
      .returning();

    if (inserted === undefined) {
      this.logger.error('Insert into api_keys returned no rows');
      throw new InternalServerErrorException('Failed to create API key');
    }

    this.logger.log(`Created API key "${name}" (id: ${inserted.id}, prefix: ${prefix})`);

    return {
      apiKey: toApiKeyResponse(inserted),
      key, // full key — returned once, never stored or returned again
    };
  }
}
