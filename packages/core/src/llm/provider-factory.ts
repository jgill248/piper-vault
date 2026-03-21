import type { LlmProviderName } from '@delve/shared';
import type { LlmProvider } from './provider.js';
import { AskSageProvider } from './ask-sage.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAiProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

/**
 * Configuration for constructing an LLM provider via the factory.
 * Each provider only reads the fields it needs; unused fields are ignored.
 */
export interface ProviderConfig {
  readonly provider: LlmProviderName;
  readonly askSageToken?: string;
  readonly anthropicApiKey?: string;
  readonly openaiApiKey?: string;
  readonly ollamaBaseUrl?: string;
  readonly defaultModel?: string;
}

/**
 * Factory function that instantiates the correct LlmProvider implementation
 * based on the `provider` field in the supplied config.
 *
 * This is the single place in the codebase that maps provider names to
 * concrete classes, keeping the rest of the system decoupled from specific
 * provider implementations.
 */
export function createLlmProvider(config: ProviderConfig): LlmProvider {
  switch (config.provider) {
    case 'ask-sage':
      return new AskSageProvider(config.askSageToken ?? '', config.defaultModel);
    case 'anthropic':
      return new AnthropicProvider(config.anthropicApiKey ?? '', config.defaultModel);
    case 'openai':
      return new OpenAiProvider(config.openaiApiKey ?? '', config.defaultModel);
    case 'ollama':
      return new OllamaProvider(config.ollamaBaseUrl, config.defaultModel);
  }
}
