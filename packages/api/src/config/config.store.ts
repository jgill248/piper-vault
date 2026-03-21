import { Injectable } from '@nestjs/common';
import type { AppConfig } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';

@Injectable()
export class ConfigStore {
  private config: AppConfig = { ...DEFAULT_CONFIG };

  get(): AppConfig {
    return { ...this.config };
  }

  update(updates: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...updates };
    return this.get();
  }
}
