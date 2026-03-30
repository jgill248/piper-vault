import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { SystemPromptPreset } from '@delve/shared';
import { UpdatePresetCommand } from './update-preset.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { systemPromptPresets } from '../../database/schema';
import { toPresetResponse } from '../dto/preset-response.dto';

@CommandHandler(UpdatePresetCommand)
export class UpdatePresetHandler
  implements ICommandHandler<UpdatePresetCommand>
{
  private readonly logger = new Logger(UpdatePresetHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: UpdatePresetCommand): Promise<SystemPromptPreset> {
    const patch: Partial<{
      name: string;
      persona: string;
      model: string | null;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (command.name !== undefined) patch.name = command.name;
    if (command.persona !== undefined) patch.persona = command.persona;
    if (command.model !== undefined) patch.model = command.model;

    const [updated] = await this.db
      .update(systemPromptPresets)
      .set(patch)
      .where(eq(systemPromptPresets.id, command.id))
      .returning();

    if (updated === undefined) {
      throw new NotFoundException(`Preset with id "${command.id}" not found`);
    }

    this.logger.log(`Updated preset "${command.id}"`);
    return toPresetResponse(updated);
  }
}
