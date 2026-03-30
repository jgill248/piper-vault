import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PresetsController } from './presets.controller';
import { CreatePresetHandler } from './commands/create-preset.handler';
import { UpdatePresetHandler } from './commands/update-preset.handler';
import { DeletePresetHandler } from './commands/delete-preset.handler';
import { ListPresetsHandler } from './queries/list-presets.handler';
import { GetPresetHandler } from './queries/get-preset.handler';

const CommandHandlers = [
  CreatePresetHandler,
  UpdatePresetHandler,
  DeletePresetHandler,
];
const QueryHandlers = [ListPresetsHandler, GetPresetHandler];

@Module({
  imports: [CqrsModule],
  controllers: [PresetsController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class PresetsModule {}
