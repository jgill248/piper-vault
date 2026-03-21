import { describe, it, expect } from 'vitest';
import { TextParser } from './text-parser.js';

const parser = new TextParser();

describe('TextParser', () => {
  it('supports text/plain and text/markdown', () => {
    expect(parser.supportedTypes).toContain('text/plain');
    expect(parser.supportedTypes).toContain('text/markdown');
  });

  it('parses plain text files', async () => {
    const buffer = Buffer.from('Hello, world!');
    const result = await parser.parse(buffer, 'test.txt');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe('Hello, world!');
      expect(result.value.metadata['filename']).toBe('test.txt');
    }
  });

  it('strips markdown formatting from .md files', async () => {
    const md = '# Heading\n\nSome **bold** and *italic* text.\n\n[Link](http://example.com)';
    const buffer = Buffer.from(md);
    const result = await parser.parse(buffer, 'readme.md');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).not.toContain('**');
      expect(result.value.text).not.toContain('[Link]');
      expect(result.value.text).toContain('Heading');
      expect(result.value.text).toContain('bold');
      expect(result.value.metadata['headings']).toEqual(['Heading']);
      expect(result.value.metadata['title']).toBe('Heading');
    }
  });

  it('handles empty files', async () => {
    const buffer = Buffer.from('');
    const result = await parser.parse(buffer, 'empty.txt');
    // Parser returns ok with empty text — chunker will reject it
    expect(result.ok).toBe(true);
  });

  it('preserves code block content in markdown', async () => {
    const md = '```js\nconsole.log("hi");\n```';
    const buffer = Buffer.from(md);
    const result = await parser.parse(buffer, 'code.md');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('console.log');
    }
  });
});
