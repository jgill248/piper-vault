/**
 * Command to regenerate a wiki page from all its contributing sources.
 *
 * When `preview` is true, returns the proposed content without writing.
 * When `preview` is false, applies the regeneration and resets userReviewed.
 */
export class RegenerateWikiPageCommand {
  constructor(
    public readonly pageId: string,
    public readonly preview: boolean = false,
  ) {}
}
