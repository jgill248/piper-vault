export class RenameFolderCommand {
  constructor(
    public readonly folderId: string,
    public readonly newPath: string,
  ) {}
}
