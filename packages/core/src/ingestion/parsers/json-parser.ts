import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { FileParser, ParsedContent } from '../parser.js';

/**
 * Recursively flattens a JSON value into key-value pairs using dot notation
 * for objects and bracket notation for array indices.
 */
function flattenValue(value: unknown, prefix: string, pairs: string[]): void {
  if (value === null || value === undefined) {
    pairs.push(`${prefix}: null`);
  } else if (typeof value === 'object' && Array.isArray(value)) {
    if (value.length === 0) {
      pairs.push(`${prefix}: []`);
    } else {
      value.forEach((item, index) => {
        flattenValue(item, `${prefix}[${index}]`, pairs);
      });
    }
  } else if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      pairs.push(`${prefix}: {}`);
    } else {
      keys.forEach((key) => {
        const childPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;
        flattenValue(obj[key], childPrefix, pairs);
      });
    }
  } else {
    pairs.push(`${prefix}: ${String(value)}`);
  }
}

/**
 * Converts a parsed JSON value into a human-readable flat text representation.
 */
function flattenJson(value: unknown): string {
  const pairs: string[] = [];

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Top-level object: iterate keys directly without a prefix
    const obj = value as Record<string, unknown>;
    Object.keys(obj).forEach((key) => {
      flattenValue(obj[key], key, pairs);
    });
  } else if (Array.isArray(value)) {
    // Top-level array: use index notation
    value.forEach((item, index) => {
      flattenValue(item, `[${index}]`, pairs);
    });
  } else {
    // Primitive at root
    pairs.push(String(value));
  }

  return pairs.join('\n');
}

export class JsonParser implements FileParser {
  readonly supportedTypes: readonly string[] = ['application/json'];

  async parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>> {
    try {
      const raw = buffer.toString('utf-8');

      if (raw.trim().length === 0) {
        return err(`JsonParser: "${filename}" is empty`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
        return err(`JsonParser: "${filename}" is not valid JSON: ${message}`);
      }

      const text = flattenJson(parsed);

      if (text.trim().length === 0) {
        return err(`JsonParser: "${filename}" produced no readable content`);
      }

      const metadata: Record<string, unknown> = {
        filename,
        mimeType: 'application/json',
        characterCount: text.length,
        topLevelType: Array.isArray(parsed) ? 'array' : typeof parsed,
      };

      if (Array.isArray(parsed)) {
        metadata['itemCount'] = parsed.length;
      } else if (typeof parsed === 'object' && parsed !== null) {
        metadata['topLevelKeys'] = Object.keys(parsed as Record<string, unknown>);
      }

      return ok({ text, metadata });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`JsonParser failed to parse "${filename}": ${message}`);
    }
  }
}
