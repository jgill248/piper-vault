import type { SystemPromptPreset } from '@delve/shared';
import type { SystemPromptPresetRow } from '../../database/schema';

export function toPresetResponse(row: SystemPromptPresetRow): SystemPromptPreset {
  return {
    id: row.id,
    name: row.name,
    persona: row.persona,
    model: row.model,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
