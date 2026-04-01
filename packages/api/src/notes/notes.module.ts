import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NotesController } from './notes.controller';
import { CreateNoteHandler } from './commands/create-note.handler';
import { UpdateNoteHandler } from './commands/update-note.handler';
import { DeleteNoteHandler } from './commands/delete-note.handler';
import { CreateFolderHandler } from './commands/create-folder.handler';
import { RenameFolderHandler } from './commands/rename-folder.handler';
import { DeleteFolderHandler } from './commands/delete-folder.handler';
import { ListNotesHandler } from './queries/list-notes.handler';
import { GetNoteHandler } from './queries/get-note.handler';
import { GetBacklinksHandler } from './queries/get-backlinks.handler';
import { GetSuggestionsHandler } from './queries/get-suggestions.handler';
import { GetGraphHandler } from './queries/get-graph.handler';
import { ListFoldersHandler } from './queries/list-folders.handler';

const CommandHandlers = [
  CreateNoteHandler,
  UpdateNoteHandler,
  DeleteNoteHandler,
  CreateFolderHandler,
  RenameFolderHandler,
  DeleteFolderHandler,
];
const QueryHandlers = [ListNotesHandler, GetNoteHandler, GetBacklinksHandler, GetSuggestionsHandler, GetGraphHandler, ListFoldersHandler];

@Module({
  imports: [CqrsModule],
  controllers: [NotesController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class NotesModule {}
