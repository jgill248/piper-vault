import { describe, it, expect } from 'vitest';
import { FilenameSchema } from './filename-validator';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parse(value: unknown) {
  return FilenameSchema.safeParse(value);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilenameSchema', () => {
  // --- Valid filenames --------------------------------------------------

  it('accepts a plain filename', () => {
    expect(parse('document.txt').success).toBe(true);
  });

  it('accepts a filename with spaces', () => {
    expect(parse('my document.txt').success).toBe(true);
  });

  it('accepts a filename with unicode characters', () => {
    expect(parse('résumé.pdf').success).toBe(true);
  });

  it('accepts a filename with dots (non-traversal)', () => {
    expect(parse('archive.tar.gz').success).toBe(true);
  });

  it('accepts a filename that is exactly 500 characters', () => {
    const name = 'a'.repeat(496) + '.txt';
    expect(parse(name).success).toBe(true);
  });

  // --- Empty / length --------------------------------------------------

  it('rejects an empty string', () => {
    expect(parse('').success).toBe(false);
  });

  it('rejects a filename exceeding 500 characters', () => {
    const name = 'a'.repeat(501);
    expect(parse(name).success).toBe(false);
  });

  // --- Path traversal / separators -------------------------------------

  it('rejects ".." traversal', () => {
    expect(parse('..').success).toBe(false);
  });

  it('rejects embedded ".." traversal', () => {
    expect(parse('../etc/passwd').success).toBe(false);
  });

  it('rejects forward slash', () => {
    expect(parse('path/to/file.txt').success).toBe(false);
  });

  it('rejects backslash', () => {
    expect(parse('path\\file.txt').success).toBe(false);
  });

  // --- Control characters ----------------------------------------------

  it('rejects a filename containing a literal tab (\\t)', () => {
    expect(parse('file\tname.txt').success).toBe(false);
  });

  it('rejects a filename containing a literal newline (\\n)', () => {
    expect(parse('file\nname.txt').success).toBe(false);
  });

  it('rejects a filename containing a carriage return (\\r)', () => {
    expect(parse('file\rname.txt').success).toBe(false);
  });

  it('rejects a filename containing a NUL byte (\\x00)', () => {
    expect(parse('file\x00name.txt').success).toBe(false);
  });

  it('rejects a filename containing DEL (\\x7F)', () => {
    expect(parse('file\x7fname.txt').success).toBe(false);
  });

  it('rejects all C0 control characters (\\x01 through \\x1F)', () => {
    for (let code = 0x01; code <= 0x1f; code++) {
      const value = `file${String.fromCharCode(code)}.txt`;
      expect(parse(value).success, `char 0x${code.toString(16)} should be rejected`).toBe(false);
    }
  });

  // --- Windows-reserved characters ------------------------------------

  it('rejects < (less-than)', () => {
    expect(parse('file<name.txt').success).toBe(false);
  });

  it('rejects > (greater-than)', () => {
    expect(parse('file>name.txt').success).toBe(false);
  });

  it('rejects : (colon)', () => {
    expect(parse('file:name.txt').success).toBe(false);
  });

  it('rejects " (double-quote)', () => {
    expect(parse('file"name.txt').success).toBe(false);
  });

  it('rejects | (pipe)', () => {
    expect(parse('file|name.txt').success).toBe(false);
  });

  it('rejects ? (question mark)', () => {
    expect(parse('file?name.txt').success).toBe(false);
  });

  it('rejects * (asterisk)', () => {
    expect(parse('file*name.txt').success).toBe(false);
  });
});
