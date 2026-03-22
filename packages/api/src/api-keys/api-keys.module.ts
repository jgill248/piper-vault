import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ApiKeysController } from './api-keys.controller';
import { CreateApiKeyHandler } from './commands/create-api-key.handler';
import { RevokeApiKeyHandler } from './commands/revoke-api-key.handler';
import { ListApiKeysHandler } from './queries/list-api-keys.handler';
import { ApiKeyService } from '../auth/api-key.service';

const CommandHandlers = [CreateApiKeyHandler, RevokeApiKeyHandler];
const QueryHandlers = [ListApiKeysHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ApiKeysController],
  providers: [...CommandHandlers, ...QueryHandlers, ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeysModule {}
