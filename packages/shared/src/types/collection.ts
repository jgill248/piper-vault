export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCollectionInput {
  readonly name: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateCollectionInput {
  readonly name?: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export const DEFAULT_COLLECTION_ID = '00000000-0000-0000-0000-000000000000';
