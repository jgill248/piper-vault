export const SOURCE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type SourceStatus = (typeof SOURCE_STATUS)[keyof typeof SOURCE_STATUS];

export const WIKI_OPERATIONS = ['ingest', 'query', 'lint', 'update'] as const;
export type WikiOperation = (typeof WIKI_OPERATIONS)[number];

export interface Source {
  readonly id: string;
  readonly filename: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly contentHash: string;
  readonly status: SourceStatus;
  readonly chunkCount: number;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly collectionId?: string;
  readonly isNote: boolean;
  readonly content?: string | null;
  readonly parentPath?: string | null;
  readonly title?: string | null;
  readonly frontmatter: Record<string, unknown>;
  readonly isGenerated: boolean;
  readonly generatedBy?: string | null;
  readonly generationSourceIds: readonly string[];
  readonly lastLintAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WikiLogEntry {
  readonly id: string;
  readonly operation: WikiOperation;
  readonly summary: string;
  readonly affectedSourceIds: readonly string[];
  readonly sourceTriggerIds?: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface CreateSourceInput {
  readonly filename: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly contentHash: string;
  readonly metadata?: Record<string, unknown>;
}
