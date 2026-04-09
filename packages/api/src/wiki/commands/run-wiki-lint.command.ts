/**
 * Command to run a wiki lint pass across all generated wiki pages.
 */
export class RunWikiLintCommand {
  constructor(
    public readonly collectionId?: string,
  ) {}
}
