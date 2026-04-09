/**
 * Event emitted after a source has been successfully ingested (status = 'ready').
 * Consumed by the WikiModule to trigger async wiki page generation.
 */
export class SourceIngestedEvent {
  constructor(
    public readonly sourceId: string,
    public readonly collectionId: string,
    public readonly filename: string,
  ) {}
}
