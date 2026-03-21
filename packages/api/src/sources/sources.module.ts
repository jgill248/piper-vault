import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SourcesController } from './sources.controller';
import { IngestSourceHandler } from './commands/ingest-source.handler';
import { DeleteSourceHandler } from './commands/delete-source.handler';
import { ReindexSourceHandler } from './commands/reindex-source.handler';
import { UpdateSourceTagsHandler } from './commands/update-source-tags.handler';
import { BulkImportHandler } from './commands/bulk-import.handler';
import { ListSourcesHandler } from './queries/list-sources.handler';
import { GetSourceHandler } from './queries/get-source.handler';
import { ListTagsHandler } from './queries/list-tags.handler';

const CommandHandlers = [IngestSourceHandler, DeleteSourceHandler, ReindexSourceHandler, UpdateSourceTagsHandler, BulkImportHandler];
const QueryHandlers = [ListSourcesHandler, GetSourceHandler, ListTagsHandler];

@Module({
  imports: [CqrsModule],
  controllers: [SourcesController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class SourcesModule {}
