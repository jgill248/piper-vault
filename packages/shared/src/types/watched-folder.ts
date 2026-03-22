export interface WatchedFolder {
  readonly id: string;
  readonly collectionId: string;
  readonly folderPath: string;
  readonly recursive: boolean;
  readonly enabled: boolean;
  readonly lastScanAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateWatchedFolderInput {
  readonly collectionId: string;
  readonly folderPath: string;
  readonly recursive?: boolean;
}
