import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { IngestSourceCommand } from '../../sources/commands/ingest-source.command';
import type { IngestSourceResult } from '../../sources/commands/ingest-source.handler';
import { WebhookIngestCommand } from './webhook-ingest.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources } from '../../database/schema';

export interface WebhookIngestResult {
  readonly sourceId: string;
  readonly chunkCount: number;
}

@CommandHandler(WebhookIngestCommand)
export class WebhookIngestHandler implements ICommandHandler<WebhookIngestCommand> {
  private readonly logger = new Logger(WebhookIngestHandler.name);

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async execute(command: WebhookIngestCommand): Promise<WebhookIngestResult> {
    const { content, filename, fileType, collectionId, tags, metadata } = command;

    // Convert text content to a Buffer
    const buffer = Buffer.from(content, 'utf-8');

    const result = await this.commandBus.execute<
      IngestSourceCommand,
      Result<IngestSourceResult, string>
    >(new IngestSourceCommand(buffer, filename, fileType, buffer.byteLength, collectionId));

    if (!result.ok) {
      this.logger.warn(`Webhook ingestion failed for "${filename}": ${result.error}`);
      throw new BadRequestException({
        error: {
          code: 'INGESTION_FAILED',
          message: result.error ?? 'Ingestion failed',
        },
      });
    }

    const { sourceId, chunkCount } = result.value;

    // Apply tags and metadata enrichment after successful ingestion
    const enrichedMetadata: Record<string, unknown> = { ...metadata, ingestedVia: 'webhook' };
    const updateSet = tags.length > 0
      ? { tags, metadata: enrichedMetadata, updatedAt: new Date() }
      : { metadata: enrichedMetadata, updatedAt: new Date() };

    await this.db
      .update(sources)
      .set(updateSet)
      .where(eq(sources.id, sourceId));

    this.logger.log(`Webhook ingested "${filename}" → source ${sourceId} (${chunkCount} chunks)`);

    return { sourceId, chunkCount };
  }
}
