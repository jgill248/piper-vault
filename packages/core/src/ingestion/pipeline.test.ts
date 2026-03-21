import { describe, it, expect } from 'vitest';
import { DefaultIngestionPipeline } from './pipeline.js';

const pipeline = new DefaultIngestionPipeline();
const config = { chunkSize: 512, chunkOverlap: 50 };

describe('DefaultIngestionPipeline', () => {
  it('ingests a plain text file', async () => {
    const buffer = Buffer.from('This is test content with enough words to be chunked properly.');
    const result = await pipeline.ingest(buffer, 'test.txt', 'text/plain', config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks.length).toBeGreaterThan(0);
      expect(result.value.contentHash).toHaveLength(64); // SHA-256 hex
      expect(result.value.metadata['filename']).toBe('test.txt');
      expect(result.value.metadata['mimeType']).toBe('text/plain');
    }
  });

  it('ingests a markdown file', async () => {
    const md = '# Title\n\nSome **bold** paragraph content with words.';
    const result = await pipeline.ingest(Buffer.from(md), 'notes.md', 'text/markdown', config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks[0]!.content).toContain('Title');
      expect(result.value.chunks[0]!.content).not.toContain('**');
    }
  });

  it('returns error for unsupported MIME type', async () => {
    const result = await pipeline.ingest(Buffer.from('data'), 'file.xyz', 'application/octet-stream', config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No parser available');
    }
  });

  it('returns error for empty content', async () => {
    const result = await pipeline.ingest(Buffer.from(''), 'empty.txt', 'text/plain', config);
    expect(result.ok).toBe(false);
  });

  it('produces a consistent content hash for identical input', async () => {
    const buffer = Buffer.from('Consistent content for hashing');
    const r1 = await pipeline.ingest(buffer, 'a.txt', 'text/plain', config);
    const r2 = await pipeline.ingest(buffer, 'b.txt', 'text/plain', config);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value.contentHash).toBe(r2.value.contentHash);
    }
  });

  it('ingests JSON files', async () => {
    const json = JSON.stringify({ key: 'value', nested: { a: 1 } });
    const result = await pipeline.ingest(Buffer.from(json), 'data.json', 'application/json', config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks[0]!.content).toContain('key: value');
    }
  });

  it('ingests HTML files', async () => {
    const html = '<html><body><p>Hello from HTML</p></body></html>';
    const result = await pipeline.ingest(Buffer.from(html), 'page.html', 'text/html', config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks[0]!.content).toContain('Hello from HTML');
    }
  });

  it('ingests CSV files', async () => {
    const csv = 'Name,Score\nAlice,95\nBob,87';
    const result = await pipeline.ingest(Buffer.from(csv), 'scores.csv', 'text/csv', config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks[0]!.content).toContain('Name: Alice');
    }
  });
});
