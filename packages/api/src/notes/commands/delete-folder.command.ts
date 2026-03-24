export class DeleteFolderCommand {
  constructor(
    public readonly folderId: string,
    public readonly deleteContents: boolean = false,
  ) {}
}
