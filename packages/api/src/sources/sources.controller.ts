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
import type { Source, PaginatedResponse } from '@delve/shared';
import { IngestSourceCommand } from './commands/ingest-source.command';
import type { IngestSourceResult } from './commands/ingest-source.handler';
import { DeleteSourceCommand } from './commands/delete-source.command';
import { ListSourcesQuery } from './queries/list-sources.query';
import { GetSourceQuery } from './queries/get-source.query';
import { CreateSourceSchema, decodeSourceBuffer } from './dto/create-source.dto';

@Controller('sources')
export class SourcesController {
  private readonly logger = new Logger(SourcesController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
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
      new IngestSourceCommand(buffer, dto.filename, dto.mimeType, buffer.byteLength),
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
   * GET /api/v1/sources
   */
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PaginatedResponse<Source>> {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedPageSize = pageSize !== undefined ? parseInt(pageSize, 10) : 20;

    return this.queryBus.execute(
      new ListSourcesQuery(
        isNaN(parsedPage) ? 1 : parsedPage,
        isNaN(parsedPageSize) ? 20 : Math.min(parsedPageSize, 100),
      ),
    );
  }

  /**
   * GET /api/v1/sources/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Source> {
    return this.queryBus.execute(new GetSourceQuery(id));
  }

  /**
   * DELETE /api/v1/sources/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new DeleteSourceCommand(id));
  }
}
