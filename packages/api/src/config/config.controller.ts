import { Controller, Get, Patch, Body, Inject, Logger, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { AppConfig } from '@delve/shared';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { LlmProvider } from '@delve/core';
import { ConfigStore } from './config.store';
import { UpdateConfigCommand } from './commands/update-config.command';

interface ModelsResponse {
  readonly models: readonly string[];
}

@Controller('config')
export class ConfigAppController {
  private readonly logger = new Logger(ConfigAppController.name);

  constructor(
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    private readonly configStore: ConfigStore,
    private readonly commandBus: CommandBus,
  ) {}

  /**
   * GET /api/v1/config
   * Returns the active application configuration.
   */
  @Get()
  getConfig(): AppConfig {
    return this.configStore.get();
  }

  /**
   * PATCH /api/v1/config
   * Merges the supplied fields into the active config after validation.
   */
  @Patch()
  async updateConfig(@Body() body: unknown): Promise<AppConfig> {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body must be a JSON object',
        },
      });
    }

    return this.commandBus.execute(new UpdateConfigCommand(body as Partial<AppConfig>));
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
