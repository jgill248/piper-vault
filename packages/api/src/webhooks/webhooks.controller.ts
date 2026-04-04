import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ReqApiKey } from '../auth/api-key.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { ApiKeyRow } from '../database/schema';
import { WebhookIngestCommand } from './commands/webhook-ingest.command';
import type { WebhookIngestResult } from './commands/webhook-ingest.handler';
import {
  WebhookIngestSchema,
  WebhookIngestUrlSchema,
  detectMimeType,
} from './dto/webhook-ingest.dto';
import { validatePublicUrl } from '../common/url-validator';

// Webhook endpoints use API key auth (ApiKeyGuard), not JWT auth.
// @Public() prevents the global JwtAuthGuard from blocking these routes.
@Public()
@Controller('webhooks')
@UseGuards(ApiKeyGuard)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(@Inject(CommandBus) private readonly commandBus: CommandBus) {}

  /**
   * POST /api/v1/webhooks/ingest
   * Ingest raw text content via API key.
   * The collectionId is taken from the API key — not the request body.
   */
  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  async ingest(
    @Body() body: unknown,
    @ReqApiKey() apiKey: ApiKeyRow,
  ): Promise<WebhookIngestResult> {
    const parsed = WebhookIngestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { content, filename, fileType, tags, metadata } = parsed.data;
    const resolvedMimeType = fileType ?? detectMimeType(filename);

    return this.commandBus.execute<WebhookIngestCommand, WebhookIngestResult>(
      new WebhookIngestCommand(
        content,
        filename,
        resolvedMimeType,
        apiKey.collectionId,
        tags ?? [],
        (metadata ?? {}) as Record<string, unknown>,
      ),
    );
  }

  /**
   * POST /api/v1/webhooks/ingest/url
   * Fetches a URL and ingests the content via API key.
   * The collectionId is taken from the API key — not the request body.
   */
  @Post('ingest/url')
  @HttpCode(HttpStatus.CREATED)
  async ingestUrl(
    @Body() body: unknown,
    @ReqApiKey() apiKey: ApiKeyRow,
  ): Promise<WebhookIngestResult> {
    const parsed = WebhookIngestUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { url, filename: providedFilename, tags } = parsed.data;

    // SSRF protection: block private/reserved IPs and non-http(s) protocols
    await validatePublicUrl(url);

    // Derive filename from URL path if not provided
    let filename = providedFilename;
    if (!filename) {
      try {
        const urlPath = new URL(url).pathname;
        filename = urlPath.split('/').filter(Boolean).pop() ?? 'document.txt';
      } catch {
        filename = 'document.txt';
      }
    }

    // Fetch the remote URL
    let content: string;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Delve/1.0 (webhook-ingestion)' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new BadRequestException({
          error: {
            code: 'FETCH_FAILED',
            message: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`,
          },
        });
      }

      content = await response.text();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException({
        error: {
          code: 'FETCH_FAILED',
          message: `Failed to fetch URL: ${message}`,
        },
      });
    }

    const resolvedMimeType = detectMimeType(filename);

    return this.commandBus.execute<WebhookIngestCommand, WebhookIngestResult>(
      new WebhookIngestCommand(
        content,
        filename,
        resolvedMimeType,
        apiKey.collectionId,
        tags ?? [],
        { sourceUrl: url, ingestedVia: 'webhook-url' },
      ),
    );
  }
}
