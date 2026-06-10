import { describe, it, expect } from 'vitest';
import { CreateSourceSchema } from './create-source.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    filename: 'document.txt',
    content: Buffer.from('hello').toString('base64'),
    mimeType: 'text/plain',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — filename validation (shared FilenameSchema wired in)
// ---------------------------------------------------------------------------

describe('CreateSourceSchema – filename validation', () => {
  it('accepts a valid filename', () => {
    expect(CreateSourceSchema.safeParse(validBody()).success).toBe(true);
  });

  it('rejects filename with tab control character', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'file\tname.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with newline control character', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'file\nname.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with NUL byte', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'file\x00name.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with carriage return', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'file\rname.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with forward slash', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'path/to/file.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with backslash', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'path\\file.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with path traversal', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: '../secret.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects filename with Windows-reserved character (*)', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: 'file*.txt' }));
    expect(result.success).toBe(false);
  });

  it('rejects empty filename', () => {
    const result = CreateSourceSchema.safeParse(validBody({ filename: '' }));
    expect(result.success).toBe(false);
  });
});
