/** Well-known UUID for the built-in "Default" preset (empty persona). */
export const DEFAULT_PRESET_ID = '00000000-0000-0000-0000-000000000001';

/** A named system-prompt preset stored in the database. */
export interface SystemPromptPreset {
  readonly id: string;
  readonly name: string;
  /** Persona text prepended to the core RAG system prompt. */
  readonly persona: string;
  /** Optional model override — when set, activating this preset also selects this model. */
  readonly model: string | null;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Payload for creating a new preset. */
export interface CreatePresetInput {
  readonly name: string;
  readonly persona: string;
  readonly model?: string;
}

/** Payload for updating an existing preset. All fields optional. */
export interface UpdatePresetInput {
  readonly name?: string;
  readonly persona?: string;
  readonly model?: string | null;
}
