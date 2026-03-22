import { createHash } from 'node:crypto';
import { ok, err } from '@delve/shared';
import type { Result, AppConfig } from '@delve/shared';
import { chunkText } from './chunker.js';
import type { TextChunk } from './chunker.js';
import { getParser } from './parsers/index.js';
import type { PluginRegistry } from '../plugins/plugin-registry.js';

export interface IngestionResult {
  readonly chunks: readonly TextChunk[];
  readonly contentHash: string;
  readonly metadata: Record<string, unknown>;
}

export interface IngestionPipeline {
  ingest(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    config: Pick<AppConfig, 'chunkSize' | 'chunkOverlap'>,
  ): Promise<Result<IngestionResult, string>>;
}

export class DefaultIngestionPipeline implements IngestionPipeline {
  /**
   * Optional plugin registry. When provided, plugin-contributed parsers are
   * checked before falling back to the built-in parser set.
   */
  constructor(private readonly pluginRegistry?: PluginRegistry) {}

  async ingest(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    config: Pick<AppConfig, 'chunkSize' | 'chunkOverlap'>,
  ): Promise<Result<IngestionResult, string>> {
    // Resolve a parser: plugin registry is checked first, then built-ins.
    const parser =
      (this.pluginRegistry?.getParser(mimeType) ?? undefined) ?? getParser(mimeType);
    if (parser === undefined) {
      return err(
        `No parser available for MIME type "${mimeType}". Supported types: ${
          ['text/plain', 'text/markdown'].join(', ')
        }`,
      );
    }

    // Parse the raw buffer into text + metadata
    const parseResult = await parser.parse(buffer, filename);
    if (!parseResult.ok) {
      return err(`Parse step failed: ${parseResult.error}`);
    }

    const { text, metadata } = parseResult.value;

    if (text.trim().length === 0) {
      return err(`Parsed content is empty for file "${filename}".`);
    }

    // Compute SHA-256 of the original raw buffer for deduplication
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    // Split into overlapping chunks
    const chunks = chunkText(text, config);

    if (chunks.length === 0) {
      return err(`Chunking produced zero chunks for file "${filename}".`);
    }

    return ok({
      chunks,
      contentHash,
      metadata: {
        ...metadata,
        filename,
        mimeType,
        fileSize: buffer.length,
        ingestedAt: new Date().toISOString(),
      },
    });
  }
}
