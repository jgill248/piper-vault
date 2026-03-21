import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ChatController } from './chat.controller';
import { SendMessageHandler } from './commands/send-message.handler';
import { DeleteConversationHandler } from './commands/delete-conversation.handler';
import { ListConversationsHandler } from './queries/list-conversations.handler';
import { GetConversationHandler } from './queries/get-conversation.handler';
import { ExportConversationHandler } from './queries/export-conversation.handler';

const CommandHandlers = [SendMessageHandler, DeleteConversationHandler];
const QueryHandlers = [ListConversationsHandler, GetConversationHandler, ExportConversationHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ChatController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class ChatModule {}
