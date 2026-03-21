export interface Chunk {
  readonly id: string;
  readonly sourceId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly embedding?: readonly number[];
  readonly tokenCount: number;
  readonly pageNumber?: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface ChunkSearchResult {
  readonly chunk: Chunk;
  readonly score: number;
  readonly source: {
    readonly id: string;
    readonly filename: string;
    readonly fileType: string;
  };
}
