import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, BadRequestException } from '@nestjs/common';
import type { ChunkSearchResult } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import { SearchChunksQuery } from './search-chunks.query';
import { RetrievalService } from '../services/retrieval.service';

@QueryHandler(SearchChunksQuery)
export class SearchChunksHandler implements IQueryHandler<SearchChunksQuery> {
  private readonly logger = new Logger(SearchChunksHandler.name);

  constructor(private readonly retrievalService: RetrievalService) {}

  async execute(query: SearchChunksQuery): Promise<ChunkSearchResult[]> {
    const topK = query.topK ?? DEFAULT_CONFIG.topKResults;
    const threshold = query.threshold ?? DEFAULT_CONFIG.similarityThreshold;

    try {
      return await this.retrievalService.search({
        query: query.query,
        topK,
        threshold,
        sourceIds: query.sourceIds,
        fileTypes: query.fileTypes,
        tags: query.tags,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        collectionId: query.collectionId,
      });
    } catch (err) {
      this.logger.error(`Search failed: ${err}`);
      throw new BadRequestException({
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to execute search query',
        },
      });
    }
  }
}
