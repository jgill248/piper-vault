export class BulkImportCommand {
  constructor(
    public readonly directoryPath: string,
    public readonly tags?: string[],
  ) {}
}
