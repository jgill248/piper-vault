/**
 * Pure cosine-similarity utilities for wiki page deduplication and
 * topical relevance matching. Framework-agnostic — operates on raw
 * embedding vectors with no database dependency.
 */

export interface PageEmbedding {
  readonly pageId: string;
  readonly title: string;
  readonly embedding: readonly number[];
}

export interface PageSimilarityResult {
  readonly pageId: string;
  readonly title: string;
  readonly similarity: number;
}

/**
 * Compute the cosine similarity between two vectors.
 * Returns a value in [-1, 1], where 1 means identical direction.
 */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * Find wiki pages whose embeddings are most similar to a query embedding.
 * Returns results above the threshold, sorted by similarity descending,
 * capped at maxResults.
 */
export function findSimilarPages(
  queryEmbedding: readonly number[],
  pageEmbeddings: readonly PageEmbedding[],
  threshold: number,
  maxResults: number,
): PageSimilarityResult[] {
  const scored: PageSimilarityResult[] = [];

  for (const page of pageEmbeddings) {
    const similarity = cosineSimilarity(queryEmbedding, page.embedding);
    if (similarity >= threshold) {
      scored.push({ pageId: page.pageId, title: page.title, similarity });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, maxResults);
}

/**
 * Average multiple embeddings into a single representative vector.
 * Useful for computing a page-level embedding from its chunk embeddings.
 * Returns an empty array if the input is empty.
 */
export function averageEmbeddings(
  embeddings: readonly (readonly number[])[],
): number[] {
  if (embeddings.length === 0) return [];
  const dims = embeddings[0]!.length;
  const result = new Array<number>(dims).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dims; i++) {
      result[i]! += emb[i]!;
    }
  }

  for (let i = 0; i < dims; i++) {
    result[i]! /= embeddings.length;
  }

  return result;
}
