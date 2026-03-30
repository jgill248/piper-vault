import { DEFAULT_PRESET_ID } from './preset.js';

export const LLM_PROVIDERS = ['ask-sage', 'anthropic', 'openai', 'ollama'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export const RERANK_STRATEGIES = ['none', 'llm'] as const;
export type RerankStrategy = (typeof RERANK_STRATEGIES)[number];

/** Per-provider non-secret settings (stored in config.json). */
export interface LlmProviderSettingsEntry {
  readonly baseUrl?: string;
}

/** Map of per-provider settings keyed by provider name. */
export type LlmProviderSettingsMap = {
  readonly [K in LlmProviderName]?: LlmProviderSettingsEntry;
};

/** Hardcoded default base URLs for each provider. */
export const DEFAULT_PROVIDER_URLS: Readonly<Record<LlmProviderName, string>> = {
  'ask-sage': 'https://api.asksage.ai/server',
  'anthropic': 'https://api.anthropic.com/v1',
  'openai': 'https://api.openai.com/v1',
  'ollama': 'http://localhost:11434',
} as const;

/** Provider status returned by GET /config/providers (credentials masked). */
export interface LlmProviderStatus {
  readonly provider: LlmProviderName;
  readonly baseUrl: string;
  readonly hasCredential: boolean;
  readonly credentialHint: string;
}

export interface AppConfig {
  readonly activePresetId: string;
  readonly llmModel: string;
  readonly llmProvider: LlmProviderName;
  readonly embeddingModel: string;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly topKResults: number;
  readonly similarityThreshold: number;
  readonly maxContextTokens: number;
  readonly maxConversationTurns: number;
  readonly hybridSearchEnabled: boolean;
  readonly hybridSearchWeight: number;
  readonly rerankEnabled: boolean;
  readonly rerankStrategy: RerankStrategy;
  readonly rerankTopN: number;
  readonly followUpQuestionsEnabled: boolean;
  /** Absolute path to the plugins directory. Empty string means disabled. */
  readonly pluginsDir: string;
  /** Whether JWT-based user authentication is enabled. Read from AUTH_ENABLED env var. */
  readonly authEnabled: boolean;
  readonly graphBoostEnabled: boolean;
  readonly graphBoostFactor: number;
  /** Per-provider settings (base URLs). Credentials stored separately in SecretsStore. */
  readonly providerSettings: LlmProviderSettingsMap;
}

export const DEFAULT_CONFIG: AppConfig = {
  activePresetId: DEFAULT_PRESET_ID,
  llmModel: 'claude-3.5-sonnet',
  llmProvider: 'ask-sage',
  embeddingModel: 'all-MiniLM-L6-v2',
  chunkSize: 512,
  chunkOverlap: 64,
  topKResults: 8,
  similarityThreshold: 0.3,
  maxContextTokens: 4000,
  maxConversationTurns: 10,
  hybridSearchEnabled: false,
  hybridSearchWeight: 0.5,
  rerankEnabled: false,
  rerankStrategy: 'none',
  rerankTopN: 5,
  followUpQuestionsEnabled: true,
  pluginsDir: '',
  authEnabled: false,
  graphBoostEnabled: false,
  graphBoostFactor: 0.15,
  providerSettings: {},
};
