import { DEFAULT_COLLECTION_ID } from '@delve/shared';

export class IngestSourceCommand {
  constructor(
    public readonly buffer: Buffer,
    public readonly filename: string,
    public readonly mimeType: string,
    public readonly fileSize: number,
    public readonly collectionId: string = DEFAULT_COLLECTION_ID,
  ) {}
}
