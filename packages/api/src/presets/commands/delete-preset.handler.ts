import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DEFAULT_PRESET_ID } from '@delve/shared';
import { DeletePresetCommand } from './delete-preset.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { systemPromptPresets } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';

@CommandHandler(DeletePresetCommand)
export class DeletePresetHandler
  implements ICommandHandler<DeletePresetCommand>
{
  private readonly logger = new Logger(DeletePresetHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
  ) {}

  async execute(command: DeletePresetCommand): Promise<void> {
    if (command.id === DEFAULT_PRESET_ID) {
      throw new BadRequestException({
        error: {
          code: 'CANNOT_DELETE_DEFAULT_PRESET',
          message: 'The default preset cannot be deleted',
        },
      });
    }

    // Verify the preset exists
    const existing = await this.db
      .select({ id: systemPromptPresets.id })
      .from(systemPromptPresets)
      .where(eq(systemPromptPresets.id, command.id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Preset with id "${command.id}" not found`);
    }

    // If deleting the currently active preset, reset to default
    const cfg = this.configStore.get();
    if (cfg.activePresetId === command.id) {
      this.configStore.update({ activePresetId: DEFAULT_PRESET_ID });
      this.logger.log('Active preset deleted — reset to default');
    }

    await this.db
      .delete(systemPromptPresets)
      .where(eq(systemPromptPresets.id, command.id));

    this.logger.log(`Deleted preset "${command.id}"`);
  }
}
