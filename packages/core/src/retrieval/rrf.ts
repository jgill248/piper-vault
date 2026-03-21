export interface RankedItem<T> {
  readonly item: T;
  readonly score: number;
}

/**
 * Reciprocal Rank Fusion merges two ranked result lists.
 * score = sum(1 / (k + rank)) for each list the item appears in.
 * k = 60 is the standard constant.
 */
export function reciprocalRankFusion<T>(
  lists: readonly (readonly RankedItem<T>[])[],
  getKey: (item: T) => string,
  k = 60,
): RankedItem<T>[] {
  const scores = new Map<string, { item: T; score: number }>();

  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const entry = list[rank]!;
      const key = getKey(entry.item);
      const existing = scores.get(key);
      const rrfScore = 1 / (k + rank + 1);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(key, { item: entry.item, score: rrfScore });
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ item, score }) => ({ item, score }));
}
