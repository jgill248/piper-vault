export interface ApiKey {
  readonly id: string;
  readonly name: string;
  /** First 8 characters of the key, for display only. Full key is never stored or returned after creation. */
  readonly prefix: string;
  readonly collectionId: string;
  readonly permissions: Record<string, unknown>;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
}

export interface CreateApiKeyInput {
  readonly name: string;
  readonly collectionId: string;
  readonly expiresAt?: string; // ISO date string
}

/** The full key is only returned once at creation time and is never stored. */
export interface ApiKeyCreatedResponse {
  readonly apiKey: ApiKey;
  readonly key: string;
}
