import { describe, it, expect } from 'vitest';
import {
  VAULT_EXPORT_FORMAT_VERSION,
  buildVaultExport,
  validateVaultExportPayload,
  type ExportedCollection,
  type ExportedSource,
  type ExportedConversation,
} from './vault-export.js';

const EMPTY_INPUT = {
  collections: [],
  sources: [],
  sourceLinks: [],
  noteFolders: [],
  conversations: [],
  wikiPageVersions: [],
  wikiLog: [],
  presets: [],
};

function makeSource(overrides: Partial<ExportedSource> = {}): ExportedSource {
  return {
    id: 's-1',
    filename: 'note.md',
    fileType: 'text/markdown',
    fileSize: 10,
    contentHash: 'hash',
    collectionId: 'c-1',
    status: 'ready',
    chunkCount: 1,
    tags: [],
    metadata: {},
    isNote: false,
    content: 'hello',
    parentPath: null,
    title: null,
    frontmatter: {},
    isGenerated: false,
    generatedBy: null,
    generationSourceIds: [],
    lastLintAt: null,
    userReviewed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildVaultExport', () => {
  it('stamps manifest with current format version and counts', () => {
    const payload = buildVaultExport({
      ...EMPTY_INPUT,
      collections: [
        { id: 'c-1', name: 'Main', description: '', metadata: {}, createdAt: 'x', updatedAt: 'x' } satisfies ExportedCollection,
      ],
      sources: [makeSource({ id: 's-1', isNote: false }), makeSource({ id: 's-2', isNote: true })],
      conversations: [
        {
          id: 'conv-1',
          title: 't',
          collectionId: 'c-1',
          createdAt: 'x',
          updatedAt: 'x',
          messages: [
            { id: 'm-1', role: 'user', content: 'hi', sources: null, model: null, createdAt: 'x' },
            { id: 'm-2', role: 'assistant', content: 'hello', sources: null, model: null, createdAt: 'x' },
          ],
        } satisfies ExportedConversation,
      ],
    });

    expect(payload.manifest.formatVersion).toBe(VAULT_EXPORT_FORMAT_VERSION);
    expect(payload.manifest.counts).toEqual({
      collections: 1,
      sources: 1,
      notes: 1,
      conversations: 1,
      messages: 2,
      noteFolders: 0,
      sourceLinks: 0,
      wikiPageVersions: 0,
      wikiLog: 0,
      presets: 0,
    });
  });

  it('is JSON-serializable', () => {
    const payload = buildVaultExport({
      ...EMPTY_INPUT,
      sources: [makeSource()],
    });
    expect(() => JSON.stringify(payload)).not.toThrow();
    const roundTrip = JSON.parse(JSON.stringify(payload));
    expect(roundTrip.sources[0].filename).toBe('note.md');
  });

  it('includes appVersion when provided', () => {
    const payload = buildVaultExport({ ...EMPTY_INPUT, appVersion: '0.10.0' });
    expect(payload.manifest.appVersion).toBe('0.10.0');
  });
});

describe('validateVaultExportPayload', () => {
  it('accepts a valid payload', () => {
    const payload = buildVaultExport(EMPTY_INPUT);
    const result = validateVaultExportPayload(payload);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-object payload', () => {
    const result = validateVaultExportPayload('not-json');
    expect(result.ok).toBe(false);
  });

  it('rejects a payload missing required array fields', () => {
    const result = validateVaultExportPayload({
      manifest: { formatVersion: 1 },
      collections: [],
      // sources missing
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('sources'))).toBe(true);
  });

  it('rejects a payload with a future format version', () => {
    const result = validateVaultExportPayload({
      manifest: { formatVersion: VAULT_EXPORT_FORMAT_VERSION + 1 },
      collections: [],
      sources: [],
      sourceLinks: [],
      noteFolders: [],
      conversations: [],
      wikiPageVersions: [],
      wikiLog: [],
      presets: [],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('format version'))).toBe(true);
  });
});
