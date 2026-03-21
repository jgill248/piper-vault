export class SearchChunksQuery {
  constructor(
    public readonly query: string,
    public readonly topK?: number,
    public readonly threshold?: number,
    public readonly sourceIds?: string[],
    public readonly fileTypes?: string[],
    public readonly dateFrom?: string,
    public readonly dateTo?: string,
  ) {}
}
