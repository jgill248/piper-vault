export class GetSuggestionsQuery {
  constructor(
    public readonly noteId: string,
    public readonly limit: number = 10,
  ) {}
}
