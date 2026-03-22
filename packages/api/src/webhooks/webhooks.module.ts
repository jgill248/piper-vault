import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WebhooksController } from './webhooks.controller';
import { WebhookIngestHandler } from './commands/webhook-ingest.handler';
import { ApiKeyService } from '../auth/api-key.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

const CommandHandlers = [WebhookIngestHandler];

@Module({
  imports: [CqrsModule],
  controllers: [WebhooksController],
  providers: [...CommandHandlers, ApiKeyService, ApiKeyGuard],
})
export class WebhooksModule {}
