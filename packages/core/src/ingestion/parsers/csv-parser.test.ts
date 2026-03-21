import { describe, it, expect } from 'vitest';
import { CsvParser } from './csv-parser.js';

const parser = new CsvParser();

describe('CsvParser', () => {
  it('supports text/csv and text/tab-separated-values', () => {
    expect(parser.supportedTypes).toContain('text/csv');
    expect(parser.supportedTypes).toContain('text/tab-separated-values');
  });

  it('parses CSV with headers', async () => {
    const csv = 'Name,Age\nAlice,30\nBob,25';
    const result = await parser.parse(Buffer.from(csv), 'data.csv');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('Name: Alice');
      expect(result.value.text).toContain('Age: 30');
      expect(result.value.metadata['rowCount']).toBe(2);
      expect(result.value.metadata['columns']).toEqual(['Name', 'Age']);
    }
  });

  it('returns error for empty file', async () => {
    const result = await parser.parse(Buffer.from(''), 'empty.csv');
    expect(result.ok).toBe(false);
  });

  it('returns error for header-only file', async () => {
    const result = await parser.parse(Buffer.from('Name,Age\n'), 'header-only.csv');
    expect(result.ok).toBe(false);
  });
});
