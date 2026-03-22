export class UpdateCollectionCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}
