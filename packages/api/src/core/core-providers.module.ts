import { Module, Global, Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import { OnnxEmbedder, DefaultIngestionPipeline, createLlmProvider, LlmReranker } from '@delve/core';
import type { LlmProvider, LlmQuery, LlmResponse, PluginRegistry } from '@delve/core';
import type { Result } from '@delve/shared';
import { ConfigStore } from '../config/config.store.js';
import { SecretsStore } from '../config/secrets.store.js';
import { RetrievalService } from '../search/services/retrieval.service';
import { PLUGIN_REGISTRY } from '../plugins/plugins.providers.js';
import { PluginsModule } from '../plugins/plugins.module.js';

/**
 * LlmProviderProxy delegates every LlmProvider call to whichever concrete
 * provider the ConfigStore currently selects.
 *
 * This avoids NestJS scope issues: the proxy is a singleton but reads the
 * active provider config on every call so that changes made through the
 * settings UI take effect without a server restart.
 */
@Injectable()
export class LlmProviderProxy implements LlmProvider {
  private provider: LlmProvider;
  private lastProvider: string = '';
  private lastConfigSnapshot: string = '';
  private lastSecretsGeneration: number = -1;

  constructor(
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SecretsStore) private readonly secretsStore: SecretsStore,
  ) {
    this.provider = this.buildProvider();
  }

  async query(input: LlmQuery): Promise<Result<LlmResponse, string>> {
    this.refreshIfNeeded();
    return this.provider.query(input);
  }

  async getModels(): Promise<Result<readonly string[], string>> {
    this.refreshIfNeeded();
    return this.provider.getModels();
  }

  /**
   * Rebuilds the inner provider when the configured provider name, model,
   * provider settings, or secrets change.
   */
  private refreshIfNeeded(): void {
    const config = this.configStore.get();
    const snapshot = JSON.stringify({
      p: config.llmProvider,
      m: config.llmModel,
      ps: config.providerSettings,
    });
    const secretsGen = this.secretsStore.generation;

    if (snapshot !== this.lastConfigSnapshot || secretsGen !== this.lastSecretsGeneration) {
      this.provider = this.buildProvider();
    }
  }

  /**
   * Constructs a fresh LlmProvider instance using layered resolution:
   *   Credentials: SecretsStore > env var > empty
   *   Base URLs: providerSettings > env var > hardcoded default
   */
  private buildProvider(): LlmProvider {
    const appConfig = this.configStore.get();
    const ps = appConfig.providerSettings;

    this.lastProvider = appConfig.llmProvider;
    this.lastConfigSnapshot = JSON.stringify({
      p: appConfig.llmProvider,
      m: appConfig.llmModel,
      ps: appConfig.providerSettings,
    });
    this.lastSecretsGeneration = this.secretsStore.generation;

    return createLlmProvider({
      provider: appConfig.llmProvider,
      // Credentials: SecretsStore > env var > empty
      askSageToken:
        this.secretsStore.getSecret('llm.ask-sage.token')
        ?? this.configService.get<string>('ASK_SAGE_TOKEN')
        ?? '',
      anthropicApiKey:
        this.secretsStore.getSecret('llm.anthropic.apiKey')
        ?? this.configService.get<string>('ANTHROPIC_API_KEY')
        ?? '',
      openaiApiKey:
        this.secretsStore.getSecret('llm.openai.apiKey')
        ?? this.configService.get<string>('OPENAI_API_KEY')
        ?? '',
      // Base URLs: providerSettings > env var > undefined (adapter uses its default)
      askSageBaseUrl: ps?.['ask-sage']?.baseUrl ?? undefined,
      anthropicBaseUrl: ps?.['anthropic']?.baseUrl ?? undefined,
      openaiBaseUrl: ps?.['openai']?.baseUrl ?? undefined,
      ollamaBaseUrl:
        ps?.['ollama']?.baseUrl
        ?? this.configService.get<string>('OLLAMA_BASE_URL'),
      defaultModel: appConfig.llmModel,
    });
  }
}

const embedderProvider: Provider = {
  provide: 'EMBEDDER',
  useFactory: async (): Promise<OnnxEmbedder> => {
    const embedder = new OnnxEmbedder();
    console.log('[OnnxEmbedder] Loading all-MiniLM-L6-v2 model...');
    await embedder.init();
    console.log('[OnnxEmbedder] Model loaded and ready.');
    return embedder;
  },
};

const ingestionPipelineProvider: Provider = {
  provide: 'INGESTION_PIPELINE',
  inject: [PLUGIN_REGISTRY],
  useFactory: (pluginRegistry: PluginRegistry): DefaultIngestionPipeline =>
    new DefaultIngestionPipeline(pluginRegistry),
};

/**
 * The LLM_PROVIDER token resolves to LlmProviderProxy, which lazily delegates
 * to the correct concrete provider based on runtime configuration.
 */
const llmProviderProvider: Provider = {
  provide: 'LLM_PROVIDER',
  useClass: LlmProviderProxy,
};

/**
 * Phase 3: LLM-based reranker. Wraps the LLM_PROVIDER to score chunk relevance.
 */
const rerankerProvider: Provider = {
  provide: 'RERANKER',
  inject: ['LLM_PROVIDER'],
  useFactory: (llm: LlmProvider): LlmReranker => new LlmReranker(llm),
};

/**
 * Global module that provides the core domain services as injectable tokens.
 * All tokens are available in every module without re-importing CoreProvidersModule.
 *
 * ConfigStore is injected into LlmProviderProxy via NestJS DI; it is exported
 * by ConfigAppModule which is @Global, so it is available here automatically.
 *
 * Phase 3 adds:
 *   - RERANKER — LlmReranker for scoring chunk relevance post-retrieval
 *   - RetrievalService — hybrid search (vector + BM25) with optional re-ranking
 */
@Global()
@Module({
  imports: [PluginsModule],
  providers: [
    LlmProviderProxy,
    embedderProvider,
    ingestionPipelineProvider,
    llmProviderProvider,
    rerankerProvider,
    RetrievalService,
  ],
  exports: [
    embedderProvider,
    ingestionPipelineProvider,
    llmProviderProvider,
    rerankerProvider,
    RetrievalService,
  ],
})
export class CoreProvidersModule {}
