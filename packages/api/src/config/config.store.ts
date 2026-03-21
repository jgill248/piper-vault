import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AppConfig } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';

const CONFIG_DIR = join(homedir(), '.delve');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

@Injectable()
export class ConfigStore {
  private readonly logger = new Logger(ConfigStore.name);
  private config: AppConfig;

  constructor() {
    this.config = this.loadFromDisk();
  }

  get(): AppConfig {
    return { ...this.config };
  }

  update(updates: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...updates };
    this.saveToDisk();
    return this.get();
  }

  private loadFromDisk(): AppConfig {
    try {
      if (existsSync(CONFIG_PATH)) {
        const raw = readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AppConfig>;
        this.logger.log(`Loaded config from ${CONFIG_PATH}`);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (err) {
      this.logger.warn(`Failed to load config from disk, using defaults: ${err}`);
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveToDisk(): void {
    try {
      const dir = dirname(CONFIG_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
      this.logger.log(`Config saved to ${CONFIG_PATH}`);
    } catch (err) {
      this.logger.warn(`Failed to persist config to disk: ${err}`);
    }
  }
}
