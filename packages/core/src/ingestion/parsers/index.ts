import type { FileParser } from '../parser.js';
import { TextParser } from './text-parser.js';
import { PdfParser } from './pdf-parser.js';
import { DocxParser } from './docx-parser.js';
import { CsvParser } from './csv-parser.js';
import { JsonParser } from './json-parser.js';
import { HtmlParser } from './html-parser.js';

export { TextParser } from './text-parser.js';
export { PdfParser } from './pdf-parser.js';
export { DocxParser } from './docx-parser.js';
export { CsvParser } from './csv-parser.js';
export { JsonParser } from './json-parser.js';
export { HtmlParser } from './html-parser.js';

const parsers: readonly FileParser[] = [
  new TextParser(),
  new PdfParser(),
  new DocxParser(),
  new CsvParser(),
  new JsonParser(),
  new HtmlParser(),
];

/**
 * Returns the appropriate FileParser for the given MIME type, or undefined
 * if no parser supports that type.
 */
export function getParser(mimeType: string): FileParser | undefined {
  return parsers.find((p) => p.supportedTypes.includes(mimeType));
}
