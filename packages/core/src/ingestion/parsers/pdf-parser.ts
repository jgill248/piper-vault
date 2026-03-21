import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { FileParser, ParsedContent } from '../parser.js';

export class PdfParser implements FileParser {
  readonly supportedTypes: readonly string[] = ['application/pdf'];

  async parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>> {
    try {
      // Dynamic import to avoid issues with pdf-parse module loading
      const pdfParse = await import('pdf-parse');
      const parse = pdfParse.default;

      const data = await parse(buffer);

      const text = data.text ?? '';

      if (text.trim().length === 0) {
        return err(`PdfParser: "${filename}" contains no extractable text`);
      }

      const metadata: Record<string, unknown> = {
        filename,
        mimeType: 'application/pdf',
        characterCount: text.length,
        pageCount: data.numpages,
        info: data.info ?? {},
      };

      return ok({ text, metadata });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`PdfParser failed to parse "${filename}": ${message}`);
    }
  }
}
