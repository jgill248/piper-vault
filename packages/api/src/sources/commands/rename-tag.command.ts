/**
 * Renames a tag across all sources/notes (optionally within one collection).
 * Renaming onto an existing tag merges the two: the result array is
 * deduplicated, so this command covers both "rename" and "merge".
 */
export class RenameTagCommand {
  constructor(
    public readonly oldTag: string,
    public readonly newTag: string,
    public readonly collectionId?: string,
  ) {}
}
