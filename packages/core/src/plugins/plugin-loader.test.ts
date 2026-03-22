import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadPlugins } from './plugin-loader.js';

// We use vi.mock to intercept node:fs/promises readdir and dynamic import
// without touching the real filesystem.

describe('loadPlugins', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty array when pluginsDir is an empty string', async () => {
    const plugins = await loadPlugins('');
    expect(plugins).toEqual([]);
  });

  it('returns an empty array when the directory does not exist', async () => {
    // The real readdir will throw ENOENT for a non-existent path.
    const plugins = await loadPlugins('/path/that/does/not/exist/__delve_test__');
    expect(plugins).toEqual([]);
  });

  it('returns an empty array when the directory is empty', async () => {
    vi.mock('node:fs/promises', () => ({
      readdir: vi.fn().mockResolvedValue([]),
    }));
    const plugins = await loadPlugins('/fake/dir');
    expect(plugins).toEqual([]);
    vi.unmock('node:fs/promises');
  });
});
