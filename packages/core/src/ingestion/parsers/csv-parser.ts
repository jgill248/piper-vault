import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { FileParser, ParsedContent } from '../parser.js';

/**
 * Converts a single parsed row (object keyed by column headers) into a
 * natural language statement suitable for embedding.
 * E.g. { Name: "Alice", Age: "30" } → "Name: Alice, Age: 30"
 */
function rowToStatement(row: Record<string, unknown>): string {
  return Object.entries(row)
    .map(([key, value]) => `${key}: ${String(value ?? '')}`)
    .join(', ');
}

export class CsvParser implements FileParser {
  readonly supportedTypes: readonly string[] = [
    'text/csv',
    'text/tab-separated-values',
  ];

  async parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>> {
    try {
      const Papa = await import('papaparse');
      const parse = Papa.default;

      const csv = buffer.toString('utf-8');

      if (csv.trim().length === 0) {
        return err(`CsvParser: "${filename}" is empty`);
      }

      const result = parse.parse<Record<string, unknown>>(csv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (result.errors.length > 0 && result.data.length === 0) {
        const firstError = result.errors[0];
        return err(
          `CsvParser failed to parse "${filename}": ${firstError?.message ?? 'unknown parse error'}`,
        );
      }

      const rows = result.data;
      const columns = result.meta.fields ?? [];

      if (rows.length === 0) {
        return err(`CsvParser: "${filename}" contains no data rows`);
      }

      const statements = rows.map(rowToStatement);
      const text = statements.join('\n');

      const metadata: Record<string, unknown> = {
        filename,
        mimeType: filename.endsWith('.tsv') ? 'text/tab-separated-values' : 'text/csv',
        characterCount: text.length,
        columns,
        rowCount: rows.length,
      };

      return ok({ text, metadata });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`CsvParser failed to parse "${filename}": ${message}`);
    }
  }
}
