import { Controller, Get, Inject, Logger } from '@nestjs/common';
import type { AppConfig } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { LlmProvider } from '@delve/core';

interface ModelsResponse {
  readonly models: readonly string[];
}

@Controller('config')
export class ConfigAppController {
  private readonly logger = new Logger(ConfigAppController.name);

  constructor(@Inject('LLM_PROVIDER') private readonly llm: LlmProvider) {}

  /**
   * GET /api/v1/config
   * Returns the active application configuration (defaults for Phase 1).
   */
  @Get()
  getConfig(): AppConfig {
    return DEFAULT_CONFIG;
  }

  /**
   * GET /api/v1/config/models
   * Proxies the list of available LLM models from the configured provider.
   */
  @Get('models')
  async getModels(): Promise<ModelsResponse> {
    const result = await this.llm.getModels();

    if (!result.ok) {
      this.logger.warn(`Failed to fetch models: ${result.error}`);
      // Return a sensible default rather than throwing — the UI can still
      // function with a static fallback list.
      return { models: [DEFAULT_CONFIG.llmModel] };
    }

    return { models: result.value };
  }
}
