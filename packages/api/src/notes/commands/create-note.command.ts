import { DEFAULT_COLLECTION_ID } from '@delve/shared';

export class CreateNoteCommand {
  constructor(
    public readonly title: string,
    public readonly content: string,
    public readonly collectionId: string = DEFAULT_COLLECTION_ID,
    public readonly parentPath: string | null = null,
    public readonly tags: readonly string[] = [],
    /** When true, skip emitting SourceIngestedEvent (used by wiki generation to prevent recursion). */
    public readonly skipWikiGeneration: boolean = false,
  ) {}
}
