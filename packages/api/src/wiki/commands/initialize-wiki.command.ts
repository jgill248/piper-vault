/**
 * Command to generate wiki pages from all existing unprocessed sources.
 * Triggered manually by the user to bootstrap the wiki from existing data.
 */
export class InitializeWikiCommand {
  constructor(public readonly collectionId?: string) {}
}
