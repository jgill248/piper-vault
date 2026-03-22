import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CollectionsController } from './collections.controller';
import { CreateCollectionHandler } from './commands/create-collection.handler';
import { UpdateCollectionHandler } from './commands/update-collection.handler';
import { DeleteCollectionHandler } from './commands/delete-collection.handler';
import { ListCollectionsHandler } from './queries/list-collections.handler';
import { GetCollectionHandler } from './queries/get-collection.handler';

const CommandHandlers = [
  CreateCollectionHandler,
  UpdateCollectionHandler,
  DeleteCollectionHandler,
];
const QueryHandlers = [ListCollectionsHandler, GetCollectionHandler];

@Module({
  imports: [CqrsModule],
  controllers: [CollectionsController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class CollectionsModule {}
