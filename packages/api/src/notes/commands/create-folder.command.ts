import { DEFAULT_COLLECTION_ID } from '@delve/shared';

export class CreateFolderCommand {
  constructor(
    public readonly path: string,
    public readonly collectionId: string = DEFAULT_COLLECTION_ID,
  ) {}
}
