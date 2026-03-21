import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ChunkSearchResult } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { Embedder } from '@delve/core';
import { SearchChunksQuery } from './search-chunks.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

interface ChunkSearchRow {
  id: string;
  source_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  page_number: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  filename: string;
  file_type: string;
  score: number;
}

@QueryHandler(SearchChunksQuery)
export class SearchChunksHandler implements IQueryHandler<SearchChunksQuery> {
  private readonly logger = new Logger(SearchChunksHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
  ) {}

  async execute(query: SearchChunksQuery): Promise<ChunkSearchResult[]> {
    const topK = query.topK ?? DEFAULT_CONFIG.topKResults;
    const threshold = query.threshold ?? DEFAULT_CONFIG.similarityThreshold;

    // Embed the search query
    const embeddingResult = await this.embedder.embed(query.query);
    if (!embeddingResult.ok) {
      throw new BadRequestException({
        error: {
          code: 'EMBEDDING_FAILED',
          message: `Failed to embed search query: ${embeddingResult.error}`,
        },
      });
    }

    const embedding = embeddingResult.value;
    const vectorLiteral = `[${[...embedding].join(',')}]`;

    // Build optional filter clauses
    const sourceFilter =
      query.sourceIds !== undefined && query.sourceIds.length > 0
        ? sql`AND c.source_id = ANY(${query.sourceIds}::uuid[])`
        : sql``;

    const fileTypeFilter =
      query.fileTypes !== undefined && query.fileTypes.length > 0
        ? sql`AND s.file_type = ANY(${query.fileTypes}::text[])`
        : sql``;

    const dateFromFilter =
      query.dateFrom !== undefined
        ? sql`AND s.created_at >= ${query.dateFrom}::timestamptz`
        : sql``;

    const dateToFilter =
      query.dateTo !== undefined
        ? sql`AND s.created_at <= ${query.dateTo}::timestamptz`
        : sql``;

    const rawRows = await this.db.execute(
      sql`
        SELECT
          c.id,
          c.source_id,
          c.chunk_index,
          c.content,
          c.token_count,
          c.page_number,
          c.metadata,
          c.created_at,
          s.filename,
          s.file_type,
          1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'ready'
          AND c.embedding IS NOT NULL
          ${sourceFilter}
          ${fileTypeFilter}
          ${dateFromFilter}
          ${dateToFilter}
        ORDER BY c.embedding <=> ${vectorLiteral}::vector
        LIMIT ${topK}
      `,
    );

    const rows = rawRows as unknown as ChunkSearchRow[];

    return rows
      .filter((r) => (r.score ?? 0) >= threshold)
      .map((r) => ({
        chunk: {
          id: r.id,
          sourceId: r.source_id,
          chunkIndex: r.chunk_index,
          content: r.content,
          tokenCount: r.token_count,
          pageNumber: r.page_number ?? undefined,
          metadata: r.metadata,
          createdAt: r.created_at,
        },
        score: r.score,
        source: {
          id: r.source_id,
          filename: r.filename,
          fileType: r.file_type,
        },
      }));
  }
}
