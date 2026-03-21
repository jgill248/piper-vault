export class SearchChunksQuery {
  constructor(
    public readonly query: string,
    public readonly topK?: number,
    public readonly threshold?: number,
    public readonly sourceIds?: readonly string[],
  ) {}
}
