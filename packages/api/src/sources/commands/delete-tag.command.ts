/**
 * Removes a tag from every source/note carrying it (optionally within one
 * collection).
 */
export class DeleteTagCommand {
  constructor(
    public readonly tag: string,
    public readonly collectionId?: string,
  ) {}
}
