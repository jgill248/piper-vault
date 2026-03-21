import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SearchController } from './search.controller';
import { SearchChunksHandler } from './queries/search-chunks.handler';

@Module({
  imports: [CqrsModule],
  controllers: [SearchController],
  providers: [SearchChunksHandler],
})
export class SearchModule {}
