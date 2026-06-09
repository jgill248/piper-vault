import { Module } from '@nestjs/common';
import { ChunkIndexingService } from './services/chunk-indexing.service';
import { WikiLinkIndexingService } from './services/wiki-link-indexing.service';

/**
 * Shared indexing infrastructure: chunk embedding/persistence and wiki-link
 * resolution, consumed by the sources and notes modules.
 */
@Module({
  providers: [ChunkIndexingService, WikiLinkIndexingService],
  exports: [ChunkIndexingService, WikiLinkIndexingService],
})
export class IndexingModule {}
