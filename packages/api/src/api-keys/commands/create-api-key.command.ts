export class CreateApiKeyCommand {
  constructor(
    public readonly name: string,
    public readonly collectionId: string,
    public readonly expiresAt: Date | undefined,
  ) {}
}
