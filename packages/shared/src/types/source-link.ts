export const LINK_TYPES = ['wiki-link', 'embed', 'heading-ref'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export interface SourceLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetSourceId: string | null;
  readonly targetFilename: string;
  readonly linkType: LinkType;
  readonly displayText: string | null;
  readonly section: string | null;
  readonly createdAt: Date;
}
