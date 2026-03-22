export class ListCollectionsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly userId?: string,
    public readonly isAdmin: boolean = false,
  ) {}
}
