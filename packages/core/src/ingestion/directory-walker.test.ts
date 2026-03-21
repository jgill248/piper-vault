import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walkDirectory } from './directory-walker.js';

describe('walkDirectory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'delve-walk-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array for empty directory', () => {
    const result = walkDirectory(tmpDir);
    expect(result).toEqual([]);
  });

  it('finds supported files in the root directory', () => {
    writeFileSync(join(tmpDir, 'notes.md'), '# Hello');
    writeFileSync(join(tmpDir, 'readme.txt'), 'Some text');

    const result = walkDirectory(tmpDir);
    const filenames = result.map((f) => f.filename).sort();

    expect(filenames).toEqual(['notes.md', 'readme.txt']);
  });

  it('skips unsupported extensions', () => {
    writeFileSync(join(tmpDir, 'image.png'), 'fake png');
    writeFileSync(join(tmpDir, 'script.js'), 'console.log("hi")');
    writeFileSync(join(tmpDir, 'data.xml'), '<root/>');
    writeFileSync(join(tmpDir, 'notes.md'), '# Valid');

    const result = walkDirectory(tmpDir);

    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('notes.md');
  });

  it('recursively walks subdirectories', () => {
    const subDir = join(tmpDir, 'subdir');
    const deepDir = join(subDir, 'deep');
    mkdirSync(subDir);
    mkdirSync(deepDir);

    writeFileSync(join(tmpDir, 'root.md'), '# root');
    writeFileSync(join(subDir, 'sub.txt'), 'sub text');
    writeFileSync(join(deepDir, 'deep.pdf'), 'fake pdf');

    const result = walkDirectory(tmpDir);
    const filenames = result.map((f) => f.filename).sort();

    expect(filenames).toEqual(['deep.pdf', 'root.md', 'sub.txt']);
  });

  it('skips hidden directories', () => {
    const hiddenDir = join(tmpDir, '.hidden');
    mkdirSync(hiddenDir);
    writeFileSync(join(hiddenDir, 'secret.md'), '# secret');
    writeFileSync(join(tmpDir, 'visible.md'), '# visible');

    const result = walkDirectory(tmpDir);

    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('visible.md');
  });

  it('skips node_modules directories', () => {
    const nmDir = join(tmpDir, 'node_modules');
    mkdirSync(nmDir);
    writeFileSync(join(nmDir, 'package.md'), '# Package');
    writeFileSync(join(tmpDir, 'real.md'), '# Real');

    const result = walkDirectory(tmpDir);

    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('real.md');
  });

  it('returns correct mimeType for each supported extension', () => {
    writeFileSync(join(tmpDir, 'doc.md'), '# md');
    writeFileSync(join(tmpDir, 'doc.txt'), 'txt');
    writeFileSync(join(tmpDir, 'doc.pdf'), 'fake pdf');
    writeFileSync(join(tmpDir, 'doc.docx'), 'fake docx');
    writeFileSync(join(tmpDir, 'doc.csv'), 'a,b');
    writeFileSync(join(tmpDir, 'doc.tsv'), 'a\tb');
    writeFileSync(join(tmpDir, 'doc.json'), '{}');
    writeFileSync(join(tmpDir, 'doc.html'), '<html/>');

    const result = walkDirectory(tmpDir);
    const byFilename = Object.fromEntries(result.map((f) => [f.filename, f.mimeType]));

    expect(byFilename['doc.md']).toBe('text/markdown');
    expect(byFilename['doc.txt']).toBe('text/plain');
    expect(byFilename['doc.pdf']).toBe('application/pdf');
    expect(byFilename['doc.docx']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(byFilename['doc.csv']).toBe('text/csv');
    expect(byFilename['doc.tsv']).toBe('text/tab-separated-values');
    expect(byFilename['doc.json']).toBe('application/json');
    expect(byFilename['doc.html']).toBe('text/html');
  });

  it('includes correct path and fileSize for each file', () => {
    const content = 'Hello, world!';
    writeFileSync(join(tmpDir, 'test.txt'), content);

    const result = walkDirectory(tmpDir);

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe(join(tmpDir, 'test.txt'));
    expect(result[0]?.fileSize).toBe(Buffer.byteLength(content));
  });
});
