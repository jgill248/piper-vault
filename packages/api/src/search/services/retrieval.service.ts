import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ChunkSearchResult } from '@delve/shared';
import type { Embedder, Reranker } from '@delve/core';
import { reciprocalRankFusion } from '@delve/core';
import type { RankedItem } from '@delve/core';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { ConfigStore } from '../../config/config.store';

export interface RetrievalOptions {
  readonly query: string;
  readonly topK: number;
  readonly threshold: number;
  readonly sourceIds?: readonly string[];
  readonly fileTypes?: readonly string[];
  readonly tags?: readonly string[];
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly collectionId?: string;
}

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

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
    @Inject('RERANKER') private readonly reranker: Reranker,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
  ) {}

  async search(options: RetrievalOptions): Promise<ChunkSearchResult[]> {
    const config = this.configStore.get();

    // Step 1: Embed the query
    const embeddingResult = await this.embedder.embed(options.query);
    if (!embeddingResult.ok) {
      this.logger.warn(`Embedding failed: ${embeddingResult.error}`);
      return [];
    }

    const embedding = embeddingResult.value;

    // Step 2: Vector search
    const vectorResults = await this.vectorSearch(embedding, options);

    // Step 3: Keyword search (if hybrid enabled)
    let finalResults: ChunkSearchResult[];
    if (config.hybridSearchEnabled) {
      const keywordResults = await this.keywordSearch(options);
      // RRF fusion
      const vectorRanked: RankedItem<ChunkSearchResult>[] = vectorResults.map(
        (r) => ({ item: r, score: r.score }),
      );
      const keywordRanked: RankedItem<ChunkSearchResult>[] = keywordResults.map(
        (r) => ({ item: r, score: r.score }),
      );
      const fused = reciprocalRankFusion(
        [vectorRanked, keywordRanked],
        (item) => item.chunk.id,
      );
      finalResults = fused.slice(0, options.topK).map((r) => r.item);
    } else {
      finalResults = vectorResults;
    }

    // Step 4: Re-rank (if enabled)
    if (
      config.rerankEnabled &&
      config.rerankStrategy === 'llm' &&
      finalResults.length > 0
    ) {
      const rerankResult = await this.reranker.rerank(
        options.query,
        finalResults,
        config.rerankTopN,
      );
      if (rerankResult.ok) {
        finalResults = rerankResult.value;
      }
    }

    return finalResults;
  }

  private async vectorSearch(
    embedding: readonly number[],
    options: RetrievalOptions,
  ): Promise<ChunkSearchResult[]> {
    const vectorLiteral = `[${[...embedding].join(',')}]`;

    // Build filter clauses
    const sourceFilter =
      options.sourceIds !== undefined && options.sourceIds.length > 0
        ? sql`AND c.source_id = ANY(${options.sourceIds as string[]}::uuid[])`
        : sql``;
    const fileTypeFilter =
      options.fileTypes !== undefined && options.fileTypes.length > 0
        ? sql`AND s.file_type = ANY(${options.fileTypes as string[]}::text[])`
        : sql``;
    const tagFilter =
      options.tags !== undefined && options.tags.length > 0
        ? sql`AND s.tags && ${options.tags as string[]}::text[]`
        : sql``;
    const dateFromFilter =
      options.dateFrom !== undefined
        ? sql`AND s.created_at >= ${options.dateFrom}::timestamptz`
        : sql``;
    const dateToFilter =
      options.dateTo !== undefined
        ? sql`AND s.created_at <= ${options.dateTo}::timestamptz`
        : sql``;
    const collectionFilter =
      options.collectionId !== undefined
        ? sql`AND s.collection_id = ${options.collectionId}::uuid`
        : sql``;

    const rawRows = await this.db.execute(
      sql`
        SELECT c.id, c.source_id, c.chunk_index, c.content, c.token_count,
               c.page_number, c.metadata, c.created_at, s.filename, s.file_type,
               1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'ready' AND c.embedding IS NOT NULL
          ${sourceFilter} ${fileTypeFilter} ${tagFilter} ${dateFromFilter} ${dateToFilter}
          ${collectionFilter}
        ORDER BY c.embedding <=> ${vectorLiteral}::vector
        LIMIT ${options.topK}
      `,
    );

    return this.mapRows(rawRows as unknown as ChunkSearchRow[], options.threshold);
  }

  private async keywordSearch(
    options: RetrievalOptions,
  ): Promise<ChunkSearchResult[]> {
    // Use PostgreSQL full-text search with ts_vector
    const tsQuery = options.query
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .join(' & ');

    if (!tsQuery) return [];

    const sourceFilter =
      options.sourceIds !== undefined && options.sourceIds.length > 0
        ? sql`AND c.source_id = ANY(${options.sourceIds as string[]}::uuid[])`
        : sql``;
    const fileTypeFilter =
      options.fileTypes !== undefined && options.fileTypes.length > 0
        ? sql`AND s.file_type = ANY(${options.fileTypes as string[]}::text[])`
        : sql``;
    const tagFilter =
      options.tags !== undefined && options.tags.length > 0
        ? sql`AND s.tags && ${options.tags as string[]}::text[]`
        : sql``;
    const dateFromFilter =
      options.dateFrom !== undefined
        ? sql`AND s.created_at >= ${options.dateFrom}::timestamptz`
        : sql``;
    const dateToFilter =
      options.dateTo !== undefined
        ? sql`AND s.created_at <= ${options.dateTo}::timestamptz`
        : sql``;
    const collectionFilter =
      options.collectionId !== undefined
        ? sql`AND s.collection_id = ${options.collectionId}::uuid`
        : sql``;

    const rawRows = await this.db.execute(
      sql`
        SELECT c.id, c.source_id, c.chunk_index, c.content, c.token_count,
               c.page_number, c.metadata, c.created_at, s.filename, s.file_type,
               ts_rank(c.search_vector, to_tsquery('english', ${tsQuery})) AS score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'ready'
          AND c.search_vector @@ to_tsquery('english', ${tsQuery})
          ${sourceFilter} ${fileTypeFilter} ${tagFilter} ${dateFromFilter} ${dateToFilter}
          ${collectionFilter}
        ORDER BY score DESC
        LIMIT ${options.topK}
      `,
    );

    return this.mapRows(rawRows as unknown as ChunkSearchRow[], 0);
  }

  private mapRows(
    rows: ChunkSearchRow[],
    threshold: number,
  ): ChunkSearchResult[] {
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
