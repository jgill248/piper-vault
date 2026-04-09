import type { WikiLogRow } from '../../database/schema';

export interface WikiLogResponse {
  readonly id: string;
  readonly operation: string;
  readonly summary: string;
  readonly affectedSourceIds: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export function toWikiLogResponse(row: WikiLogRow): WikiLogResponse {
  return {
    id: row.id,
    operation: row.operation,
    summary: row.summary,
    affectedSourceIds: row.affectedSourceIds as string[],
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}
