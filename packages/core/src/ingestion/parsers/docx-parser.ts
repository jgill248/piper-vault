import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { FileParser, ParsedContent } from '../parser.js';

export class DocxParser implements FileParser {
  readonly supportedTypes: readonly string[] = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  async parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>> {
    try {
      const mammoth = await import('mammoth');

      const result = await mammoth.extractRawText({ buffer });

      const text = result.value ?? '';

      if (text.trim().length === 0) {
        return err(`DocxParser: "${filename}" contains no extractable text`);
      }

      const metadata: Record<string, unknown> = {
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        characterCount: text.length,
        warnings: result.messages
          .filter((m) => m.type === 'warning')
          .map((m) => m.message),
      };

      return ok({ text, metadata });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`DocxParser failed to parse "${filename}": ${message}`);
    }
  }
}
