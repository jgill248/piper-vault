export class SendMessageCommand {
  constructor(
    public readonly message: string,
    public readonly conversationId?: string,
    public readonly model?: string,
  ) {}
}
