export class UpdateNoteCommand {
  constructor(
    public readonly noteId: string,
    public readonly content?: string,
    public readonly title?: string,
    public readonly parentPath?: string | null,
    public readonly tags?: readonly string[],
  ) {}
}
