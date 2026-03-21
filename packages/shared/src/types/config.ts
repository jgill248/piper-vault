export interface AppConfig {
  readonly llmModel: string;
  readonly embeddingModel: string;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly topKResults: number;
  readonly similarityThreshold: number;
  readonly maxContextTokens: number;
  readonly maxConversationTurns: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  llmModel: 'claude-3.5-sonnet',
  embeddingModel: 'all-MiniLM-L6-v2',
  chunkSize: 512,
  chunkOverlap: 64,
  topKResults: 8,
  similarityThreshold: 0.72,
  maxContextTokens: 4000,
  maxConversationTurns: 10,
};
