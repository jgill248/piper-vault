export const LLM_PROVIDERS = ['ask-sage', 'anthropic', 'openai', 'ollama'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export const RERANK_STRATEGIES = ['none', 'llm'] as const;
export type RerankStrategy = (typeof RERANK_STRATEGIES)[number];

export interface AppConfig {
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
}

export const DEFAULT_CONFIG: AppConfig = {
  llmModel: 'claude-3.5-sonnet',
  llmProvider: 'ask-sage',
  embeddingModel: 'all-MiniLM-L6-v2',
  chunkSize: 512,
  chunkOverlap: 64,
  topKResults: 8,
  similarityThreshold: 0.72,
  maxContextTokens: 4000,
  maxConversationTurns: 10,
  hybridSearchEnabled: false,
  hybridSearchWeight: 0.5,
  rerankEnabled: false,
  rerankStrategy: 'none',
  rerankTopN: 5,
  followUpQuestionsEnabled: true,
};
