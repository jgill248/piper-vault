import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { sanitizePath } from './path-validator';
import { resolve } from 'node:path';

describe('sanitizePath', () => {
  it('rejects paths containing null bytes', () => {
    expect(() => sanitizePath('/safe/path\0/etc/passwd')).toThrow(BadRequestException);
  });

  it('normalizes relative traversal sequences', () => {
    const result = sanitizePath('/tmp/safe/../../../etc/passwd');
    // path.resolve collapses the ../.. — result should NOT contain ".."
    expect(result).not.toContain('..');
  });

  it('returns an absolute path for relative input', () => {
    const result = sanitizePath('some/relative/path');
    expect(result).toMatch(/^[A-Z]:\\/i); // Windows absolute path
  });

  it('resolves . to current directory', () => {
    const result = sanitizePath('.');
    expect(result).toBe(resolve('.'));
  });

  it('resolves .. to parent directory', () => {
    const result = sanitizePath('..');
    expect(result).toBe(resolve('..'));
  });

  it('returns normalized path for non-existent paths', () => {
    const result = sanitizePath('/does/not/exist/anywhere/at/all');
    // Should return the resolved path even though it doesn't exist
    expect(result).toBeTruthy();
    expect(result).not.toContain('..');
  });

  it('handles paths with multiple consecutive separators', () => {
    const result = sanitizePath('/tmp///safe///path');
    expect(result).not.toContain('//');
  });
});
