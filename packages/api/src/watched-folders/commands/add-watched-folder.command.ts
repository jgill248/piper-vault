export class AddWatchedFolderCommand {
  constructor(
    public readonly collectionId: string,
    public readonly folderPath: string,
    public readonly recursive: boolean,
  ) {}
}
