import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { SystemPromptPreset } from '@delve/shared';
import { GetPresetQuery } from './get-preset.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { systemPromptPresets } from '../../database/schema';
import { toPresetResponse } from '../dto/preset-response.dto';

@QueryHandler(GetPresetQuery)
export class GetPresetHandler implements IQueryHandler<GetPresetQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetPresetQuery): Promise<SystemPromptPreset> {
    const rows = await this.db
      .select()
      .from(systemPromptPresets)
      .where(eq(systemPromptPresets.id, query.id))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Preset with id "${query.id}" not found`);
    }

    return toPresetResponse(row);
  }
}
