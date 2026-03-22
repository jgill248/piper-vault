import type { ApiKey } from '@delve/shared';
import type { ApiKeyRow } from '../../database/schema';

/**
 * Maps a database ApiKeyRow to the public ApiKey response DTO.
 * NEVER includes keyHash — only the prefix is safe to expose.
 */
export function toApiKeyResponse(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    collectionId: row.collectionId,
    permissions: (row.permissions ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  };
}
