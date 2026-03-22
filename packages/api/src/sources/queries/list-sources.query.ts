export class ListSourcesQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly collectionId?: string,
  ) {}
}
