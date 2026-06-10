import { describe, it, expect } from 'vitest';
import { dedupeByTitle } from './get-suggestions.handler';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeSuggestion(
  sourceId: string,
  title: string | null,
  score: number,
  filename = `${title ?? sourceId}.md`,
) {
  return { sourceId, title, filename, score };
}

// ---------------------------------------------------------------------------
// dedupeByTitle
// ---------------------------------------------------------------------------

describe('dedupeByTitle', () => {
  it('returns an empty array for an empty input', () => {
    expect(dedupeByTitle([])).toEqual([]);
  });

  it('passes through rows with unique titles unchanged', () => {
    const rows = [
      makeSuggestion('a', 'Alpha', 0.9),
      makeSuggestion('b', 'Beta', 0.8),
      makeSuggestion('c', 'Gamma', 0.7),
    ];
    expect(dedupeByTitle(rows)).toHaveLength(3);
  });

  it('keeps only the highest-scoring row when two rows share the same title', () => {
    // Input is sorted descending by score as the SQL query produces
    const rows = [
      makeSuggestion('user-note', 'My Topic', 0.92),
      makeSuggestion('wiki-copy', 'My Topic', 0.85),
    ];
    const result = dedupeByTitle(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe('user-note');
  });

  it('deduplicates case-insensitively', () => {
    const rows = [
      makeSuggestion('a', 'machine learning', 0.9),
      makeSuggestion('b', 'Machine Learning', 0.7),
    ];
    const result = dedupeByTitle(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe('a');
  });

  it('treats null-titled rows as unique (never merged)', () => {
    const rows = [
      makeSuggestion('a', null, 0.9),
      makeSuggestion('b', null, 0.8),
      makeSuggestion('c', 'Real Title', 0.7),
    ];
    const result = dedupeByTitle(rows);
    // Both null-titled rows pass through because they cannot collide
    expect(result).toHaveLength(3);
  });

  it('does not merge a null-titled row with a titled row', () => {
    const rows = [
      makeSuggestion('a', null, 0.9),
      makeSuggestion('b', 'Topic', 0.8),
    ];
    const result = dedupeByTitle(rows);
    expect(result).toHaveLength(2);
  });

  it('preserves insertion order for non-duplicate rows', () => {
    const rows = [
      makeSuggestion('a', 'Alpha', 0.9),
      makeSuggestion('b', 'Beta', 0.8),
      makeSuggestion('c', 'Gamma', 0.7),
    ];
    const result = dedupeByTitle(rows);
    expect(result.map((r) => r.sourceId)).toEqual(['a', 'b', 'c']);
  });

  it('handles multiple distinct title groups with duplicates in each', () => {
    const rows = [
      makeSuggestion('a1', 'Alpha', 0.9),
      makeSuggestion('b1', 'Beta', 0.85),
      makeSuggestion('a2', 'ALPHA', 0.7),  // dup of Alpha
      makeSuggestion('b2', 'beta', 0.6),   // dup of Beta
      makeSuggestion('c1', 'Gamma', 0.5),
    ];
    const result = dedupeByTitle(rows);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.sourceId)).toEqual(['a1', 'b1', 'c1']);
  });
});
