import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ChatController } from './chat.controller';
import { SendMessageHandler } from './commands/send-message.handler';
import { ListConversationsHandler } from './queries/list-conversations.handler';
import { GetConversationHandler } from './queries/get-conversation.handler';

const CommandHandlers = [SendMessageHandler];
const QueryHandlers = [ListConversationsHandler, GetConversationHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ChatController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class ChatModule {}
