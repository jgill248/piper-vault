import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
  Logger,
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { z } from 'zod';
import type { Source, PaginatedResponse } from '@delve/shared';
import { IngestSourceCommand } from './commands/ingest-source.command';
import type { IngestSourceResult } from './commands/ingest-source.handler';
import { DeleteSourceCommand } from './commands/delete-source.command';
import { ReindexSourceCommand } from './commands/reindex-source.command';
import { UpdateSourceTagsCommand } from './commands/update-source-tags.command';
import { ListSourcesQuery } from './queries/list-sources.query';
import { GetSourceQuery } from './queries/get-source.query';
import { ListTagsQuery } from './queries/list-tags.query';
import { CreateSourceSchema, decodeSourceBuffer } from './dto/create-source.dto';
import { BulkImportCommand } from './commands/bulk-import.command';
import type { BulkImportResult } from './commands/bulk-import.handler';

const UpdateTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).max(100),
});

const BulkImportSchema = z.object({
  directoryPath: z.string().min(1),
  tags: z.array(z.string().min(1).max(50)).optional(),
  collectionId: z.string().uuid().optional(),
});

@Controller('sources')
export class SourcesController {
  private readonly logger = new Logger(SourcesController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /api/v1/sources/upload
   * Accepts a JSON body with base64-encoded file content.
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  async upload(@Body() body: unknown): Promise<{ sourceId: string; chunkCount: number }> {
    const parsed = CreateSourceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;
    let buffer: Buffer;
    try {
      buffer = decodeSourceBuffer(dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException({
        error: { code: 'FILE_TOO_LARGE', message },
      });
    }

    const result = await this.commandBus.execute<IngestSourceCommand, { ok: boolean; value?: IngestSourceResult; error?: string }>(
      new IngestSourceCommand(buffer, dto.filename, dto.mimeType, buffer.byteLength, dto.collectionId),
    );

    if (!result.ok) {
      throw new BadRequestException({
        error: { code: 'INGESTION_FAILED', message: result.error ?? 'Ingestion failed' },
      });
    }

    return {
      sourceId: result.value!.sourceId,
      chunkCount: result.value!.chunkCount,
    };
  }

  /**
   * GET /api/v1/sources/tags
   * Returns all unique tags across all sources, sorted alphabetically.
   * Declared before GET /:id so NestJS does not match "tags" as an id param.
   */
  @Get('tags')
  async listTags(): Promise<string[]> {
    return this.queryBus.execute(new ListTagsQuery());
  }

  /**
   * GET /api/v1/sources
   */
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('collectionId') collectionId?: string,
  ): Promise<PaginatedResponse<Source>> {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedPageSize = pageSize !== undefined ? parseInt(pageSize, 10) : 20;

    if (isNaN(parsedPage) || parsedPage < 1) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'page must be a positive integer' },
      });
    }
    if (isNaN(parsedPageSize) || parsedPageSize < 1) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'pageSize must be a positive integer' },
      });
    }

    return this.queryBus.execute(
      new ListSourcesQuery(
        parsedPage,
        Math.min(parsedPageSize, 100),
        collectionId,
      ),
    );
  }

  /**
   * POST /api/v1/sources/bulk-import
   * Accepts a local filesystem directory path and ingests all supported files found within it.
   */
  @Post('bulk-import')
  @HttpCode(HttpStatus.OK)
  async bulkImport(@Body() body: unknown): Promise<BulkImportResult> {
    const parsed = BulkImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.flatten() },
      });
    }
    return this.commandBus.execute(
      new BulkImportCommand(parsed.data.directoryPath, parsed.data.tags, parsed.data.collectionId),
    );
  }

  /**
   * GET /api/v1/sources/:id
   */
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string): Promise<Source> {
    return this.queryBus.execute(new GetSourceQuery(id));
  }

  /**
   * DELETE /api/v1/sources/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.commandBus.execute(new DeleteSourceCommand(id));
  }

  /**
   * POST /api/v1/sources/:id/reindex
   * Triggers re-ingestion of an existing source.
   * Phase 2 stub — returns 501 until Phase 3 implements stored content.
   */
  @Post(':id/reindex')
  @HttpCode(HttpStatus.OK)
  async reindex(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.commandBus.execute(new ReindexSourceCommand(id));
  }

  /**
   * PATCH /api/v1/sources/:id/tags
   * Replaces the full set of tags on the specified source.
   */
  @Patch(':id/tags')
  async updateTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<{ tags: string[] }> {
    const parsed = UpdateTagsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }
    return this.commandBus.execute(new UpdateSourceTagsCommand(id, parsed.data.tags));
  }
}
