/**
 * Command to promote a chat conversation (or specific message) to a wiki page.
 */
export class PromoteToWikiCommand {
  constructor(
    public readonly conversationId: string,
    public readonly messageId: string | undefined,
    public readonly collectionId: string,
  ) {}
}
