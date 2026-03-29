import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigAppController } from './config.controller';
import { ConfigStore } from './config.store';
import { SecretsStore } from './secrets.store';
import { UpdateConfigHandler } from './commands/update-config.handler';
import { UpdateProviderSettingsHandler } from './commands/update-provider-settings.handler';
import { GetProviderSettingsHandler } from './queries/get-provider-settings.handler';

const CommandHandlers = [UpdateConfigHandler, UpdateProviderSettingsHandler];
const QueryHandlers = [GetProviderSettingsHandler];

@Global()
@Module({
  imports: [CqrsModule],
  controllers: [ConfigAppController],
  providers: [ConfigStore, SecretsStore, ...CommandHandlers, ...QueryHandlers],
  exports: [ConfigStore, SecretsStore],
})
export class ConfigAppModule {}
