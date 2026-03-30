import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import type { SystemPromptPreset } from '@delve/shared';
import { ListPresetsQuery } from './list-presets.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { systemPromptPresets } from '../../database/schema';
import { toPresetResponse } from '../dto/preset-response.dto';

@QueryHandler(ListPresetsQuery)
export class ListPresetsHandler implements IQueryHandler<ListPresetsQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(_query: ListPresetsQuery): Promise<SystemPromptPreset[]> {
    const rows = await this.db
      .select()
      .from(systemPromptPresets)
      .orderBy(systemPromptPresets.createdAt);

    return rows.map(toPresetResponse);
  }
}
