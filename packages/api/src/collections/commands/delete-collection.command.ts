export type DeleteCollectionMode = 'cascade' | 'reassign';

export class DeleteCollectionCommand {
  constructor(
    public readonly id: string,
    public readonly mode: DeleteCollectionMode = 'reassign',
    /** When set, verifies the collection belongs to this user (unless admin). */
    public readonly requestingUserId?: string,
    public readonly requestingUserIsAdmin: boolean = false,
  ) {}
}
