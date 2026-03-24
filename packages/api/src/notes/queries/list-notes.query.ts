export class ListNotesQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly collectionId?: string,
    public readonly parentPath?: string,
    public readonly search?: string,
    public readonly tag?: string,
  ) {}
}
