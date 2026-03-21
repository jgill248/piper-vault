import { createHash } from 'node:crypto';
import { ok } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { Embedder } from './embedder.js';

const DIMENSIONS = 384;

/**
 * Produces a deterministic pseudo-random number in [-1, 1] from a 32-bit
 * unsigned integer seed using a simple xorshift algorithm.
 */
function xorshift32(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  // Map unsigned 32-bit range to [-1, 1]
  return (x >>> 0) / 0xffffffff * 2 - 1;
}

/**
 * Derives a 32-bit seed from the first 4 bytes of a SHA-256 digest of the
 * input text, combined with the dimension index so each position is
 * independently varied.
 */
function seedForTextAndDimension(digestBytes: Buffer, dimension: number): number {
  // Read the first 4 bytes as a big-endian uint32, then XOR with the dimension
  // index to produce a distinct seed per position.
  const base =
    ((digestBytes[0] ?? 0) << 24) |
    ((digestBytes[1] ?? 0) << 16) |
    ((digestBytes[2] ?? 0) << 8) |
    (digestBytes[3] ?? 0);
  return (base ^ (dimension * 2654435761)) >>> 0;
}

/**
 * Generates a deterministic pseudo-random unit-length embedding vector of
 * length `dimensions` for the given text.
 */
function generateEmbedding(text: string, dimensions: number): readonly number[] {
  const digest = createHash('sha256').update(text, 'utf-8').digest();

  const raw = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i++) {
    const seed = seedForTextAndDimension(digest, i);
    raw[i] = xorshift32(seed);
  }

  // L2-normalize to unit length so cosine similarity equals dot product
  let squaredSum = 0;
  for (const v of raw) {
    squaredSum += v * v;
  }
  const norm = Math.sqrt(squaredSum);

  if (norm === 0) {
    // Degenerate case: return a zero vector (should not occur in practice)
    return new Array<number>(dimensions).fill(0);
  }

  return raw.map((v) => v / norm);
}

/**
 * MockEmbedder produces deterministic, normalized 384-dimensional embeddings
 * from text content without requiring an external model. Intended for
 * development and testing until the ONNX runtime is wired up.
 *
 * Two identical strings always produce identical embeddings. The vectors are
 * L2-normalized to unit length, making cosine similarity equivalent to a dot
 * product.
 */
export class MockEmbedder implements Embedder {
  readonly dimensions: number = DIMENSIONS;

  async embed(text: string): Promise<Result<readonly number[], string>> {
    return ok(generateEmbedding(text, this.dimensions));
  }

  async embedBatch(
    texts: readonly string[],
  ): Promise<Result<readonly (readonly number[])[], string>> {
    const embeddings = texts.map((text) => generateEmbedding(text, this.dimensions));
    return ok(embeddings);
  }
}
