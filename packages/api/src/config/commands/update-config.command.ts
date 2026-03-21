import type { AppConfig } from '@delve/shared';

export class UpdateConfigCommand {
  constructor(public readonly updates: Partial<AppConfig>) {}
}
