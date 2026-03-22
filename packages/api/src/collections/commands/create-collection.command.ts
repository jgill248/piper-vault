export class CreateCollectionCommand {
  constructor(
    public readonly name: string,
    public readonly description?: string,
    public readonly metadata?: Record<string, unknown>,
    public readonly userId?: string,
  ) {}
}
