import type { Source } from '@delve/shared';
import type { SourceRow } from '../../database/schema';

/**
 * Maps a database SourceRow to the shared Source domain type used in API
 * responses. Converts snake_case DB columns to camelCase domain fields.
 */
export function toSourceResponse(row: SourceRow): Source {
  return {
    id: row.id,
    filename: row.filename,
    fileType: row.fileType,
    fileSize: row.fileSize,
    contentHash: row.contentHash,
    status: row.status as Source['status'],
    chunkCount: row.chunkCount,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    collectionId: row.collectionId,
    isNote: row.isNote,
    content: row.content,
    parentPath: row.parentPath,
    title: row.title,
    frontmatter: (row.frontmatter ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
