export class WebhookIngestCommand {
  constructor(
    public readonly content: string,
    public readonly filename: string,
    public readonly fileType: string,
    public readonly collectionId: string,
    public readonly tags: string[],
    public readonly metadata: Record<string, unknown>,
  ) {}
}
