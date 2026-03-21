import type { FileParser } from '../parser.js';
import { TextParser } from './text-parser.js';

export { TextParser } from './text-parser.js';

const parsers: readonly FileParser[] = [new TextParser()];

/**
 * Returns the appropriate FileParser for the given MIME type, or undefined
 * if no parser supports that type.
 */
export function getParser(mimeType: string): FileParser | undefined {
  return parsers.find((p) => p.supportedTypes.includes(mimeType));
}
