export const SOURCE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type SourceStatus = (typeof SOURCE_STATUS)[keyof typeof SOURCE_STATUS];

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
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSourceInput {
  readonly filename: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly contentHash: string;
  readonly metadata?: Record<string, unknown>;
}
