import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WatchedFoldersController } from './watched-folders.controller';
import { AddWatchedFolderHandler } from './commands/add-watched-folder.handler';
import { RemoveWatchedFolderHandler } from './commands/remove-watched-folder.handler';
import { ScanWatchedFolderHandler } from './commands/scan-watched-folder.handler';
import { ListWatchedFoldersHandler } from './queries/list-watched-folders.handler';
import { WatcherManagerService } from './services/watcher-manager.service';

const CommandHandlers = [
  AddWatchedFolderHandler,
  RemoveWatchedFolderHandler,
  ScanWatchedFolderHandler,
];

const QueryHandlers = [ListWatchedFoldersHandler];

@Module({
  imports: [CqrsModule],
  controllers: [WatchedFoldersController],
  providers: [...CommandHandlers, ...QueryHandlers, WatcherManagerService],
})
export class WatchedFoldersModule {}
