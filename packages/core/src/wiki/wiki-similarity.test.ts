import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  findSimilarPages,
  averageEmbeddings,
} from './wiki-similarity.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('computes correct similarity for known vectors', () => {
    // cos([1,1], [1,0]) = 1/(sqrt(2)*1) ≈ 0.7071
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2, 10);
  });
});

describe('findSimilarPages', () => {
  const pages = [
    { pageId: 'a', title: 'Page A', embedding: [1, 0, 0] },
    { pageId: 'b', title: 'Page B', embedding: [0, 1, 0] },
    { pageId: 'c', title: 'Page C', embedding: [0.9, 0.1, 0] },
    { pageId: 'd', title: 'Page D', embedding: [0.5, 0.5, 0] },
  ];

  it('returns pages above threshold sorted by similarity', () => {
    const results = findSimilarPages([1, 0, 0], pages, 0.5, 10);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]!.pageId).toBe('a'); // exact match
    // All results above threshold
    for (const r of results) {
      expect(r.similarity).toBeGreaterThanOrEqual(0.5);
    }
    // Sorted descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.similarity).toBeLessThanOrEqual(results[i - 1]!.similarity);
    }
  });

  it('respects maxResults', () => {
    const results = findSimilarPages([1, 0, 0], pages, 0, 2);
    expect(results).toHaveLength(2);
  });

  it('returns empty array when no pages above threshold', () => {
    const results = findSimilarPages([0, 0, 1], pages, 0.99, 10);
    expect(results).toHaveLength(0);
  });

  it('handles empty page list', () => {
    const results = findSimilarPages([1, 0, 0], [], 0, 10);
    expect(results).toHaveLength(0);
  });
});

describe('averageEmbeddings', () => {
  it('averages two vectors', () => {
    const result = averageEmbeddings([[2, 4], [6, 8]]);
    expect(result).toEqual([4, 6]);
  });

  it('returns single vector unchanged', () => {
    const result = averageEmbeddings([[1, 2, 3]]);
    expect(result).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    expect(averageEmbeddings([])).toEqual([]);
  });

  it('handles three vectors', () => {
    const result = averageEmbeddings([[3, 0, 0], [0, 3, 0], [0, 0, 3]]);
    expect(result).toEqual([1, 1, 1]);
  });
});
