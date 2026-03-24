export interface NoteFolder {
  readonly id: string;
  readonly path: string;
  readonly collectionId: string;
  readonly sortOrder: number;
  readonly createdAt: Date;
}
