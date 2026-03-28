import type { LlmProviderName } from '@delve/shared';

export class UpdateProviderSettingsCommand {
  constructor(
    public readonly provider: LlmProviderName,
    public readonly baseUrl?: string,
    public readonly apiKey?: string,
  ) {}
}
