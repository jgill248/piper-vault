export class UpdateSourceTagsCommand {
  constructor(
    public readonly sourceId: string,
    public readonly tags: string[],
  ) {}
}
