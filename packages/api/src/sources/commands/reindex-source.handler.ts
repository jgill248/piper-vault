import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Embedder } from '@delve/core';
import { ReindexSourceCommand } from './reindex-source.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, chunks } from '../../database/schema';

export interface ReindexSourceResult {
  readonly sourceId: string;
  readonly chunksReindexed: number;
}

@CommandHandler(ReindexSourceCommand)
export class ReindexSourceHandler implements ICommandHandler<ReindexSourceCommand> {
  private readonly logger = new Logger(ReindexSourceHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
  ) {}

  async execute(command: ReindexSourceCommand): Promise<ReindexSourceResult> {
    // Verify source exists
    const [source] = await this.db
      .select({ id: sources.id, filename: sources.filename })
      .from(sources)
      .where(eq(sources.id, command.id))
      .limit(1);

    if (source === undefined) {
      throw new NotFoundException(`Source ${command.id} not found`);
    }

    // Mark as processing
    await this.db
      .update(sources)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(sources.id, command.id));

    // Fetch all chunks for this source
    const chunkRows = await this.db
      .select({ id: chunks.id, content: chunks.content })
      .from(chunks)
      .where(eq(chunks.sourceId, command.id));

    if (chunkRows.length === 0) {
      await this.db
        .update(sources)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(eq(sources.id, command.id));
      return { sourceId: command.id, chunksReindexed: 0 };
    }

    // Re-embed all chunks
    const contents = chunkRows.map((c) => c.content);
    const embeddingResult = await this.embedder.embedBatch(contents);

    if (!embeddingResult.ok) {
      this.logger.error(`Re-embedding failed for source ${command.id}: ${embeddingResult.error}`);
      await this.db
        .update(sources)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(sources.id, command.id));
      throw new Error(`Embedding failed: ${embeddingResult.error}`);
    }

    const embeddings = embeddingResult.value;

    // Update each chunk with new embedding
    for (let i = 0; i < chunkRows.length; i++) {
      const chunk = chunkRows[i]!;
      const embedding = embeddings[i];
      if (embedding !== undefined) {
        await this.db
          .update(chunks)
          .set({ embedding: [...embedding] })
          .where(eq(chunks.id, chunk.id));
      }
    }

    // Mark as ready
    await this.db
      .update(sources)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(sources.id, command.id));

    this.logger.log(
      `Reindexed source "${source.filename}" (${chunkRows.length} chunks re-embedded)`,
    );

    return { sourceId: command.id, chunksReindexed: chunkRows.length };
  }
}
