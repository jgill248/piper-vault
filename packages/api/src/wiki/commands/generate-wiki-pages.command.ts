/**
 * Command to generate wiki pages from a newly ingested source.
 * Dispatched asynchronously via the SourceIngestedEvent listener.
 */
export class GenerateWikiPagesCommand {
  constructor(
    public readonly sourceId: string,
    public readonly collectionId: string,
  ) {}
}
