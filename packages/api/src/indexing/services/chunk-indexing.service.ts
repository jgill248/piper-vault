import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Result } from '@delve/shared';
import type { Embedder, TextChunk } from '@delve/core';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { chunks } from '../../database/schema';

/**
 * Shared chunk embedding + persistence used by source ingestion and note
 * create/update. Owns only the embed → insert step; status transitions on
 * the parent source stay in the command handlers.
 */
@Injectable()
export class ChunkIndexingService {
  private readonly logger = new Logger(ChunkIndexingService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
  ) {}

  /**
   * Embeds the given chunks and inserts them for the source.
   * Returns the number of chunks stored.
   */
  async embedAndStoreChunks(
    sourceId: string,
    textChunks: readonly TextChunk[],
  ): Promise<Result<number, string>> {
    if (textChunks.length === 0) {
      return { ok: true, value: 0 };
    }

    const contents = textChunks.map((c) => c.content);
    const embeddingResult = await this.embedder.embedBatch(contents);

    if (!embeddingResult.ok) {
      return { ok: false, error: `Embedding failed: ${embeddingResult.error}` };
    }

    const embeddings = embeddingResult.value;

    try {
      const chunkRows = textChunks.map((chunk, index) => ({
        sourceId,
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding: embeddings[index] !== undefined ? [...embeddings[index]] : undefined,
        tokenCount: chunk.tokenCount,
        pageNumber: typeof chunk.metadata['pageNumber'] === 'number'
          ? chunk.metadata['pageNumber']
          : undefined,
        metadata: chunk.metadata as Record<string, unknown>,
      }));

      await this.db.insert(chunks).values(chunkRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to insert chunks for source ${sourceId}: ${message}`);
      return { ok: false, error: `Failed to store chunks: ${message}` };
    }

    return { ok: true, value: textChunks.length };
  }
}
