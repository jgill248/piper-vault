import type { WatchedFolderRow } from '../../database/schema';
import type { WatchedFolder } from '@delve/shared';

export function toWatchedFolderResponse(row: WatchedFolderRow): WatchedFolder {
  return {
    id: row.id,
    collectionId: row.collectionId,
    folderPath: row.folderPath,
    recursive: row.recursive,
    enabled: row.enabled,
    lastScanAt: row.lastScanAt ?? null,
    createdAt: row.createdAt,
  };
}
