import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import type { SystemPromptPreset } from '@delve/shared';
import { CreatePresetCommand } from './create-preset.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { systemPromptPresets } from '../../database/schema';
import { toPresetResponse } from '../dto/preset-response.dto';

@CommandHandler(CreatePresetCommand)
export class CreatePresetHandler
  implements ICommandHandler<CreatePresetCommand>
{
  private readonly logger = new Logger(CreatePresetHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: CreatePresetCommand): Promise<SystemPromptPreset> {
    const [inserted] = await this.db
      .insert(systemPromptPresets)
      .values({
        name: command.name,
        persona: command.persona,
        model: command.model ?? null,
      })
      .returning();

    if (inserted === undefined) {
      throw new InternalServerErrorException('Failed to create preset');
    }

    this.logger.log(`Created preset "${command.name}" (id: ${inserted.id})`);
    return toPresetResponse(inserted);
  }
}
