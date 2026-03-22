import { DEFAULT_COLLECTION_ID } from '@delve/shared';

export class BulkImportCommand {
  constructor(
    public readonly directoryPath: string,
    public readonly tags?: string[],
    public readonly collectionId: string = DEFAULT_COLLECTION_ID,
  ) {}
}
