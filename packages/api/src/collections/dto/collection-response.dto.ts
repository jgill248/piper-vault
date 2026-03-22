import type { Collection } from '@delve/shared';
import type { CollectionRow } from '../../database/schema';

export function toCollectionResponse(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
