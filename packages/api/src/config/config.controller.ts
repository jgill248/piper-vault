import { Controller, Get, Patch, Body, Param, Query, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AppConfig, LlmProviderName, LlmProviderStatus } from '@delve/shared';
import { DEFAULT_CONFIG, LLM_PROVIDERS } from '@delve/shared';
import type { LlmProvider } from '@delve/core';
import { createLlmProvider } from '@delve/core';
import { ConfigStore } from './config.store';
import { SecretsStore } from './secrets.store';
import { UpdateConfigCommand } from './commands/update-config.command';
import { UpdateProviderSettingsCommand } from './commands/update-provider-settings.command';
import { GetProviderSettingsQuery } from './queries/get-provider-settings.query';

interface ModelsResponse {
  readonly models: readonly string[];
}

interface UpdateProviderBody {
  readonly baseUrl?: string;
  readonly apiKey?: string;
}

@Controller('config')
export class ConfigAppController {
  private readonly logger = new Logger(ConfigAppController.name);

  constructor(
    @Inject('LLM_PROVIDER') private readonly llm: LlmProvider,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(SecretsStore) private readonly secretsStore: SecretsStore,
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /api/v1/config
   * Returns the active application configuration, including runtime flags
   * such as authEnabled that are derived from environment variables.
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
   * GET /api/v1/config/models?provider=<name>
   * Proxies the list of available LLM models.
   *
   * If `provider` is supplied and is a valid LlmProviderName, a temporary
   * provider instance is built for that provider using the stored settings
   * and secrets, so the UI can preview models before saving the selection.
   * Falls back to the active (saved) provider when omitted.
   */
  @Get('models')
  async getModels(@Query('provider') providerParam?: string): Promise<ModelsResponse> {
    let llm: LlmProvider = this.llm;

    if (providerParam !== undefined) {
      if (!(LLM_PROVIDERS as readonly string[]).includes(providerParam)) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Unknown provider: ${providerParam}. Must be one of: ${LLM_PROVIDERS.join(', ')}`,
          },
        });
      }

      const appConfig = this.configStore.get();
      const ps = appConfig.providerSettings;
      llm = createLlmProvider({
        provider: providerParam as LlmProviderName,
        askSageToken: this.secretsStore.getSecret('llm.ask-sage.token') ?? '',
        anthropicApiKey: this.secretsStore.getSecret('llm.anthropic.apiKey') ?? '',
        openaiApiKey: this.secretsStore.getSecret('llm.openai.apiKey') ?? '',
        askSageBaseUrl: ps?.['ask-sage']?.baseUrl ?? undefined,
        anthropicBaseUrl: ps?.['anthropic']?.baseUrl ?? undefined,
        openaiBaseUrl: ps?.['openai']?.baseUrl ?? undefined,
        ollamaBaseUrl: ps?.['ollama']?.baseUrl ?? undefined,
        defaultModel: appConfig.llmModel,
      });
    }

    const result = await llm.getModels();

    if (!result.ok) {
      this.logger.warn(`Failed to fetch models: ${result.error}`);
      // Return a sensible default rather than throwing — the UI can still
      // function with a static fallback list.
      return { models: [DEFAULT_CONFIG.llmModel] };
    }

    return { models: result.value };
  }

  /**
   * GET /api/v1/config/providers
   * Returns the status of all LLM providers including effective base URLs
   * and masked credential hints.
   */
  @Get('providers')
  async getProviderSettings(): Promise<LlmProviderStatus[]> {
    return this.queryBus.execute(new GetProviderSettingsQuery());
  }

  /**
   * PATCH /api/v1/config/providers/:provider
   * Updates base URL and/or API key for a specific LLM provider.
   */
  @Patch('providers/:provider')
  async updateProviderSettings(
    @Param('provider') provider: string,
    @Body() body: UpdateProviderBody,
  ): Promise<LlmProviderStatus> {
    if (!(LLM_PROVIDERS as readonly string[]).includes(provider)) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: `Unknown provider: ${provider}. Must be one of: ${LLM_PROVIDERS.join(', ')}`,
        },
      });
    }

    return this.commandBus.execute(
      new UpdateProviderSettingsCommand(
        provider as LlmProviderName,
        body.baseUrl,
        body.apiKey,
      ),
    );
  }
}
