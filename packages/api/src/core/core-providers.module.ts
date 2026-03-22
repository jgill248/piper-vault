import { Module, Global, Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import { MockEmbedder, DefaultIngestionPipeline, createLlmProvider, LlmReranker } from '@delve/core';
import type { LlmProvider, LlmQuery, LlmResponse, PluginRegistry } from '@delve/core';
import type { Result } from '@delve/shared';
import { ConfigStore } from '../config/config.store.js';
import { RetrievalService } from '../search/services/retrieval.service';
import { PLUGIN_REGISTRY } from '../plugins/plugins.providers.js';

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

  constructor(
    private readonly configStore: ConfigStore,
    private readonly configService: ConfigService,
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
   * Rebuilds the inner provider when the configured provider name changes.
   * Called before each delegated method to pick up runtime config changes.
   */
  private refreshIfNeeded(): void {
    const current = this.configStore.get().llmProvider;
    if (current !== this.lastProvider) {
      this.provider = this.buildProvider();
    }
  }

  /**
   * Constructs a fresh LlmProvider instance from the current AppConfig and
   * environment variables. Environment variables supply secrets (API keys);
   * AppConfig supplies user-facing settings (provider name, model).
   */
  private buildProvider(): LlmProvider {
    const appConfig = this.configStore.get();
    this.lastProvider = appConfig.llmProvider;

    return createLlmProvider({
      provider: appConfig.llmProvider,
      askSageToken: this.configService.get<string>('ASK_SAGE_TOKEN') ?? '',
      anthropicApiKey: this.configService.get<string>('ANTHROPIC_API_KEY') ?? '',
      openaiApiKey: this.configService.get<string>('OPENAI_API_KEY') ?? '',
      ollamaBaseUrl: this.configService.get<string>('OLLAMA_BASE_URL'),
      defaultModel: appConfig.llmModel,
    });
  }
}

const embedderProvider: Provider = {
  provide: 'EMBEDDER',
  useFactory: (): MockEmbedder => new MockEmbedder(),
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
