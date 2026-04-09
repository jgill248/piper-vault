/**
 * Command to generate wiki pages from a newly ingested source.
 * Dispatched asynchronously via the SourceIngestedEvent listener.
 *
 * When `force` is true, the handler skips the `wikiAutoIngest` config check.
 * Used by the wiki initialization flow to process sources on explicit user request.
 */
export class GenerateWikiPagesCommand {
  constructor(
    public readonly sourceId: string,
    public readonly collectionId: string,
    public readonly force: boolean = false,
  ) {}
}
