import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { z } from 'zod';
import type { ChunkSearchResult } from '@delve/shared';
import { SearchChunksQuery } from './queries/search-chunks.query';

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional(),
  threshold: z.number().min(0).max(1).optional(),
  sourceIds: z.array(z.string().uuid()).optional(),
  fileTypes: z.array(z.string().min(1)).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

@Controller('search')
export class SearchController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * POST /api/v1/search
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async search(@Body() body: unknown): Promise<ChunkSearchResult[]> {
    const parsed = SearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search request',
          details: parsed.error.flatten(),
        },
      });
    }

    const { query, topK, threshold, sourceIds, fileTypes, dateFrom, dateTo } = parsed.data;
    return this.queryBus.execute(
      new SearchChunksQuery(query, topK, threshold, sourceIds, fileTypes, dateFrom, dateTo),
    );
  }
}
