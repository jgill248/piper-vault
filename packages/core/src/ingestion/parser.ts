import type { Result } from '@delve/shared';

export interface ParsedContent {
  readonly text: string;
  readonly metadata: Record<string, unknown>;
}

export interface FileParser {
  readonly supportedTypes: readonly string[];
  parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>>;
}
