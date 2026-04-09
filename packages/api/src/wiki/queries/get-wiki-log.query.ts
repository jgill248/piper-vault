export class GetWikiLogQuery {
  constructor(
    public readonly limit: number = 50,
    public readonly offset: number = 0,
    public readonly operation?: string,
  ) {}
}
