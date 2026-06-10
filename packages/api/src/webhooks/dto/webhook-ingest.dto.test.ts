import { describe, it, expect } from 'vitest';
import { WebhookIngestSchema, WebhookIngestUrlSchema, detectMimeType } from './webhook-ingest.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validIngestBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    content: 'hello world',
    filename: 'document.txt',
    ...overrides,
  };
}

function validUrlBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    url: 'https://example.com/document.txt',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — WebhookIngestSchema filename validation
// ---------------------------------------------------------------------------

describe('WebhookIngestSchema – filename validation', () => {
  it('accepts a valid ingest payload', () => {
    expect(WebhookIngestSchema.safeParse(validIngestBody()).success).toBe(true);
  });

  it('rejects filename with tab control character', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'file\tname.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with newline control character', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'file\nname.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with carriage return', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'file\rname.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with NUL byte', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'file\x00name.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with forward slash', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'path/to/file.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with backslash', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'path\\file.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with path traversal', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: '../secret.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with Windows-reserved character (?)', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: 'file?.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects empty filename', () => {
    const result = WebhookIngestSchema.safeParse(validIngestBody({ filename: '' }));
    expect(result.success).toBe(false);
  });

  it('accepts optional tags and metadata alongside valid filename', () => {
    const result = WebhookIngestSchema.safeParse(
      validIngestBody({ tags: ['research', 'ai'], metadata: { author: 'Alice' } }),
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — WebhookIngestUrlSchema filename validation (optional field)
// ---------------------------------------------------------------------------

describe('WebhookIngestUrlSchema – optional filename validation', () => {
  it('accepts payload without filename (filename is optional)', () => {
    expect(WebhookIngestUrlSchema.safeParse(validUrlBody()).success).toBe(true);
  });

  it('accepts payload with a valid filename', () => {
    const result = WebhookIngestUrlSchema.safeParse(validUrlBody({ filename: 'article.html' }));
    expect(result.success).toBe(true);
  });

  it('rejects provided filename with tab control character', () => {
    const result = WebhookIngestUrlSchema.safeParse(
      validUrlBody({ filename: 'file\tname.txt' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects provided filename with newline control character', () => {
    const result = WebhookIngestUrlSchema.safeParse(
      validUrlBody({ filename: 'file\nname.txt' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects provided filename with NUL byte', () => {
    const result = WebhookIngestUrlSchema.safeParse(
      validUrlBody({ filename: 'file\x00name.txt' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects provided filename with forward slash', () => {
    const result = WebhookIngestUrlSchema.safeParse(
      validUrlBody({ filename: 'path/to/file.txt' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects provided filename with Windows-reserved character (<)', () => {
    const result = WebhookIngestUrlSchema.safeParse(
      validUrlBody({ filename: 'file<name.txt' }),
    );
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — detectMimeType
// ---------------------------------------------------------------------------

describe('detectMimeType', () => {
  it('returns correct MIME type for .md', () => {
    expect(detectMimeType('note.md')).toBe('text/markdown');
  });

  it('returns correct MIME type for .txt', () => {
    expect(detectMimeType('README.txt')).toBe('text/plain');
  });

  it('returns text/plain for unknown extension', () => {
    expect(detectMimeType('archive.xyz')).toBe('text/plain');
  });

  it('is case-insensitive for extensions', () => {
    expect(detectMimeType('NOTE.MD')).toBe('text/markdown');
  });
});
