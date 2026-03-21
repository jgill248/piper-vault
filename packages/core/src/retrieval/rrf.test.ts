import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from './rrf.js';
import type { RankedItem } from './rrf.js';

interface Item {
  id: string;
  value: string;
}

const getKey = (item: Item): string => item.id;

describe('reciprocalRankFusion', () => {
  it('returns items in the same order for a single list', () => {
    const items: RankedItem<Item>[] = [
      { item: { id: 'a', value: 'first' }, score: 0.9 },
      { item: { id: 'b', value: 'second' }, score: 0.7 },
      { item: { id: 'c', value: 'third' }, score: 0.5 },
    ];

    const result = reciprocalRankFusion([items], getKey);

    expect(result.map((r) => r.item.id)).toEqual(['a', 'b', 'c']);
  });

  it('produces same ranking for two identical lists', () => {
    const items: RankedItem<Item>[] = [
      { item: { id: 'a', value: 'first' }, score: 0.9 },
      { item: { id: 'b', value: 'second' }, score: 0.7 },
      { item: { id: 'c', value: 'third' }, score: 0.5 },
    ];

    const result = reciprocalRankFusion([items, items], getKey);

    expect(result.map((r) => r.item.id)).toEqual(['a', 'b', 'c']);
  });

  it('merges disjoint lists correctly', () => {
    const listA: RankedItem<Item>[] = [
      { item: { id: 'a', value: 'alpha' }, score: 0.9 },
      { item: { id: 'b', value: 'beta' }, score: 0.7 },
    ];
    const listB: RankedItem<Item>[] = [
      { item: { id: 'c', value: 'gamma' }, score: 0.8 },
      { item: { id: 'd', value: 'delta' }, score: 0.6 },
    ];

    const result = reciprocalRankFusion([listA, listB], getKey);

    // All four items should appear
    const ids = result.map((r) => r.item.id);
    expect(ids).toHaveLength(4);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).toContain('d');
    // Top items from each list should rank higher than lower items
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
  });

  it('returns empty result for empty lists', () => {
    const result = reciprocalRankFusion([], getKey);
    expect(result).toEqual([]);
  });

  it('returns empty result for lists containing only empty arrays', () => {
    const result = reciprocalRankFusion([[], []], getKey);
    expect(result).toEqual([]);
  });

  it('items appearing in multiple lists score higher than items in one list', () => {
    const sharedItem: Item = { id: 'shared', value: 'appears in both' };
    const onlyInA: Item = { id: 'only-a', value: 'only in list A' };
    const onlyInB: Item = { id: 'only-b', value: 'only in list B' };

    const listA: RankedItem<Item>[] = [
      { item: sharedItem, score: 0.5 },
      { item: onlyInA, score: 0.9 },
    ];
    const listB: RankedItem<Item>[] = [
      { item: sharedItem, score: 0.5 },
      { item: onlyInB, score: 0.9 },
    ];

    const result = reciprocalRankFusion([listA, listB], getKey);

    // The shared item (rank 0 in both lists) should outscore items that appear in only one list
    expect(result[0]!.item.id).toBe('shared');
  });

  it('uses custom k parameter', () => {
    const items: RankedItem<Item>[] = [
      { item: { id: 'a', value: 'first' }, score: 0.9 },
      { item: { id: 'b', value: 'second' }, score: 0.7 },
    ];

    const resultDefaultK = reciprocalRankFusion([items], getKey);
    const resultCustomK = reciprocalRankFusion([items], getKey, 1);

    // Order should be the same regardless of k
    expect(resultDefaultK.map((r) => r.item.id)).toEqual(
      resultCustomK.map((r) => r.item.id),
    );

    // But scores differ: with k=1, rank-0 score = 1/(1+0+1) = 0.5; with k=60, = 1/61
    expect(resultCustomK[0]!.score).toBeGreaterThan(resultDefaultK[0]!.score);
  });
});
