import type { LlmProviderName } from '@delve/shared';
import type { LlmProvider } from './provider.js';
import { AskSageProvider } from './ask-sage.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAiProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import {
  ResilientLlmProvider,
  type ResilientProviderEntry,
  type ResilientProviderOptions,
} from './resilient-provider.js';

/**
 * Configuration for constructing an LLM provider via the factory.
 * Each provider only reads the fields it needs; unused fields are ignored.
 */
export interface ProviderConfig {
  readonly provider: LlmProviderName;
  readonly askSageToken?: string;
  readonly askSageBaseUrl?: string;
  readonly anthropicApiKey?: string;
  readonly anthropicBaseUrl?: string;
  readonly openaiApiKey?: string;
  readonly openaiBaseUrl?: string;
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
      return new AskSageProvider(config.askSageToken ?? '', config.defaultModel, config.askSageBaseUrl);
    case 'anthropic':
      return new AnthropicProvider(config.anthropicApiKey ?? '', config.defaultModel, config.anthropicBaseUrl);
    case 'openai':
      return new OpenAiProvider(config.openaiApiKey ?? '', config.defaultModel, config.openaiBaseUrl);
    case 'ollama':
      return new OllamaProvider(config.ollamaBaseUrl, config.defaultModel);
  }
}

/**
 * Builds a ResilientLlmProvider that wraps the primary provider plus any
 * configured fallbacks with exponential-backoff retry on transient failures.
 *
 * `fallbackProviders` lists provider names to try (in order) when the primary
 * exhausts retries or returns a terminal error. Each named provider uses the
 * same shared credentials in `config` — this lets an OpenAI primary fail over
 * to Ollama without re-entering keys.
 */
export function createResilientLlmProvider(
  config: ProviderConfig,
  fallbackProviders: readonly LlmProviderName[] = [],
  options: ResilientProviderOptions = {},
): LlmProvider {
  const entries: ResilientProviderEntry[] = [];

  entries.push({ name: config.provider, provider: createLlmProvider(config) });

  const seen = new Set<LlmProviderName>([config.provider]);
  for (const name of fallbackProviders) {
    if (seen.has(name)) continue;
    seen.add(name);
    entries.push({
      name,
      provider: createLlmProvider({ ...config, provider: name }),
    });
  }

  if (entries.length === 1) {
    // A lone primary still benefits from retry, so keep the wrapper.
    return new ResilientLlmProvider(entries, options);
  }

  return new ResilientLlmProvider(entries, options);
}
