export class ExportConversationQuery {
  constructor(
    public readonly id: string,
    public readonly format?: 'markdown' | 'wikilink',
  ) {}
}
