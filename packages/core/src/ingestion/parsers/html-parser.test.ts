import { describe, it, expect } from 'vitest';
import { HtmlParser } from './html-parser.js';

const parser = new HtmlParser();

describe('HtmlParser', () => {
  it('supports text/html', () => {
    expect(parser.supportedTypes).toContain('text/html');
  });

  it('extracts text from paragraphs', async () => {
    const html = '<html><body><p>Hello world</p><p>Second paragraph</p></body></html>';
    const result = await parser.parse(Buffer.from(html), 'page.html');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('Hello world');
      expect(result.value.text).toContain('Second paragraph');
    }
  });

  it('strips script and style tags', async () => {
    const html = '<html><body><script>alert("x")</script><p>Content</p><style>.x{}</style></body></html>';
    const result = await parser.parse(Buffer.from(html), 'page.html');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).not.toContain('alert');
      expect(result.value.text).not.toContain('.x{}');
      expect(result.value.text).toContain('Content');
    }
  });

  it('extracts headings into metadata', async () => {
    const html = '<html><body><h1>Title</h1><h2>Subtitle</h2><p>Text</p></body></html>';
    const result = await parser.parse(Buffer.from(html), 'page.html');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const headings = result.value.metadata['headings'] as string[];
      expect(headings).toContain('H1: Title');
      expect(headings).toContain('H2: Subtitle');
    }
  });

  it('extracts title from <title> tag', async () => {
    const html = '<html><head><title>My Page</title></head><body><p>Content</p></body></html>';
    const result = await parser.parse(Buffer.from(html), 'page.html');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata['title']).toBe('My Page');
    }
  });

  it('returns error for empty file', async () => {
    const result = await parser.parse(Buffer.from(''), 'empty.html');
    expect(result.ok).toBe(false);
  });

  it('returns error for HTML with no readable text', async () => {
    const html = '<html><body><script>only script</script></body></html>';
    const result = await parser.parse(Buffer.from(html), 'empty-content.html');
    expect(result.ok).toBe(false);
  });
});
