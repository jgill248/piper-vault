import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ChunkSearchResult } from '@delve/shared';
import type { Embedder, Reranker } from '@delve/core';
import { reciprocalRankFusion } from '@delve/core';
import type { RankedItem } from '@delve/core';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { ConfigStore } from '../../config/config.store';

export interface NoteMetadataOptions {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly dateField?: 'created_at' | 'updated_at';
  readonly collectionId?: string;
  readonly tags?: readonly string[];
  readonly limit?: number;
}

export interface NoteMetadataRow {
  id: string;
  title: string | null;
  filename: string;
  tags: string[];
  content: string | null;
  created_at: Date;
  updated_at: Date;
  parent_path: string | null;
}

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

    // Step 5: Graph-aware boost (if enabled)
    if (config.graphBoostEnabled && finalResults.length > 0) {
      finalResults = await this.applyGraphBoost(
        finalResults,
        config.graphBoostFactor,
        options,
      );
    }

    return finalResults;
  }

  /**
   * Search for notes by metadata (date range, tags, collection).
   * Returns source-level data (not chunks) for temporal/listing queries.
   */
  async searchNotesByMetadata(
    options: NoteMetadataOptions,
  ): Promise<NoteMetadataRow[]> {
    const limit = options.limit ?? 50;
    const dateField = options.dateField ?? 'created_at';

    const dateCol =
      dateField === 'updated_at' ? sql`s.updated_at` : sql`s.created_at`;

    const collectionFilter =
      options.collectionId !== undefined
        ? sql`AND s.collection_id = ${options.collectionId}::uuid`
        : sql``;
    const tagFilter =
      options.tags !== undefined && options.tags.length > 0
        ? sql`AND s.tags && ${options.tags as string[]}::text[]`
        : sql``;

    const rawRows = await this.db.execute(
      sql`
        SELECT s.id, s.title, s.filename, s.tags, s.content,
               s.created_at, s.updated_at, s.parent_path
        FROM sources s
        WHERE s.is_note = true
          AND s.status = 'ready'
          AND ${dateCol} >= ${options.dateFrom}::timestamptz
          AND ${dateCol} <= ${options.dateTo}::timestamptz
          ${collectionFilter} ${tagFilter}
        ORDER BY s.created_at DESC
        LIMIT ${limit}
      `,
    );

    return rawRows as unknown as NoteMetadataRow[];
  }

  private async vectorSearch(
    embedding: readonly number[],
    options: RetrievalOptions,
  ): Promise<ChunkSearchResult[]> {
    // Validate embedding values are finite numbers (defense-in-depth, CWE-89)
    if (!embedding.every((v) => Number.isFinite(v))) {
      throw new Error('Embedding contains non-finite values');
    }
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

  /**
   * Applies one-hop graph boost: chunks from sources linked to already-matched
   * sources get an additive score bump. This surfaces topologically related
   * content that may not match lexically or semantically.
   */
  private async applyGraphBoost(
    results: ChunkSearchResult[],
    boostFactor: number,
    options: RetrievalOptions,
  ): Promise<ChunkSearchResult[]> {
    // Collect unique source IDs from current results
    const matchedSourceIds = [...new Set(results.map((r) => r.source.id))];
    if (matchedSourceIds.length === 0) return results;

    // Find source IDs linked to matched sources (one hop, both directions)
    const linkedRows = await this.db.execute(
      sql`
        SELECT DISTINCT COALESCE(sl.target_source_id, NULL) AS linked_id
        FROM source_links sl
        WHERE sl.source_id = ANY(${matchedSourceIds}::uuid[])
          AND sl.target_source_id IS NOT NULL
        UNION
        SELECT DISTINCT sl.source_id AS linked_id
        FROM source_links sl
        WHERE sl.target_source_id = ANY(${matchedSourceIds}::uuid[])
      `,
    );

    const linkedSourceIds = (linkedRows as unknown as { linked_id: string }[])
      .map((r) => r.linked_id)
      .filter((id) => !matchedSourceIds.includes(id));

    if (linkedSourceIds.length === 0) return results;

    // Boost existing results from linked sources
    const boostedResults = results.map((r) => {
      if (linkedSourceIds.includes(r.source.id)) {
        return { ...r, score: r.score + boostFactor };
      }
      return r;
    });

    // Fetch additional chunks from linked sources not yet in results
    const existingChunkIds = new Set(results.map((r) => r.chunk.id));
    const collectionFilter =
      options.collectionId !== undefined
        ? sql`AND s.collection_id = ${options.collectionId}::uuid`
        : sql``;

    const additionalRows = await this.db.execute(
      sql`
        SELECT c.id, c.source_id, c.chunk_index, c.content, c.token_count,
               c.page_number, c.metadata, c.created_at, s.filename, s.file_type,
               ${boostFactor}::float AS score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'ready'
          AND c.source_id = ANY(${linkedSourceIds}::uuid[])
          ${collectionFilter}
        ORDER BY c.chunk_index
        LIMIT 10
      `,
    );

    const additionalResults = this.mapRows(
      additionalRows as unknown as ChunkSearchRow[],
      0,
    ).filter((r) => !existingChunkIds.has(r.chunk.id));

    // Combine, sort by score descending, trim to topK
    const combined = [...boostedResults, ...additionalResults];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, options.topK);
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
