import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import { MockEmbedder, DefaultIngestionPipeline, AskSageProvider } from '@delve/core';

/**
 * Global module that provides the core domain services as injectable tokens.
 * These are available in every module without re-importing CoreProvidersModule.
 *
 * Phase 1 uses:
 *   - MockEmbedder  — deterministic 384-dim embeddings, no external model needed
 *   - DefaultIngestionPipeline — parse + chunk pipeline
 *   - AskSageProvider — LLM via the Ask Sage REST API
 */
const embedderProvider: Provider = {
  provide: 'EMBEDDER',
  useFactory: (): MockEmbedder => new MockEmbedder(),
};

const ingestionPipelineProvider: Provider = {
  provide: 'INGESTION_PIPELINE',
  useFactory: (): DefaultIngestionPipeline => new DefaultIngestionPipeline(),
};

const llmProviderProvider: Provider = {
  provide: 'LLM_PROVIDER',
  inject: [ConfigService],
  useFactory: (config: ConfigService): AskSageProvider => {
    // ASK_SAGE_TOKEN is required in production. Fall back to an empty string
    // for local development so the server boots without crashing; queries
    // will return a provider error at runtime if the token is missing.
    const token = config.get<string>('ASK_SAGE_TOKEN') ?? '';
    const defaultModel = config.get<string>('DEFAULT_LLM_MODEL') ?? 'claude-3.5-sonnet';
    return new AskSageProvider(token, defaultModel);
  },
};

@Global()
@Module({
  providers: [embedderProvider, ingestionPipelineProvider, llmProviderProvider],
  exports: [embedderProvider, ingestionPipelineProvider, llmProviderProvider],
})
export class CoreProvidersModule {}
