export class SendMessageCommand {
  constructor(
    public readonly message: string,
    public readonly conversationId?: string,
    public readonly model?: string,
    public readonly sourceIds?: string[],
    public readonly fileTypes?: string[],
    public readonly dateFrom?: string,
    public readonly dateTo?: string,
  ) {}
}
