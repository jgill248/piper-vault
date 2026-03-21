import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigAppController } from './config.controller';
import { ConfigStore } from './config.store';
import { UpdateConfigHandler } from './commands/update-config.handler';

const CommandHandlers = [UpdateConfigHandler];

@Global()
@Module({
  imports: [CqrsModule],
  controllers: [ConfigAppController],
  providers: [ConfigStore, ...CommandHandlers],
  exports: [ConfigStore],
})
export class ConfigAppModule {}
