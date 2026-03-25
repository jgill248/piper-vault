/**
 * Real embedding implementation using all-MiniLM-L6-v2 via ONNX.
 *
 * Uses @huggingface/transformers to run the model locally — no external
 * API calls required. The ONNX model (~30 MB) is auto-downloaded and
 * cached on first use.
 */

import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { Embedder } from './embedder.js';

const DIMENSIONS = 384;
const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const BATCH_SIZE = 32;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeatureExtractionPipeline = any;

/**
 * OnnxEmbedder produces real 384-dimensional semantic embeddings using the
 * all-MiniLM-L6-v2 sentence transformer model running locally via ONNX.
 *
 * The model is lazily loaded on the first call to `embed()` or `embedBatch()`.
 * Call `init()` explicitly at startup to pre-load and avoid first-call latency.
 */
export class OnnxEmbedder implements Embedder {
  readonly dimensions: number = DIMENSIONS;

  private extractor: FeatureExtractionPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  /**
   * Pre-load the ONNX model. Safe to call multiple times — subsequent calls
   * are no-ops. The model is downloaded and cached automatically by
   * @huggingface/transformers.
   */
  async init(): Promise<void> {
    if (this.extractor) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.loadModel();
    await this.initPromise;
  }

  private async loadModel(): Promise<void> {
    // Dynamic import to avoid issues with CommonJS/ESM interop in NestJS webpack
    const { pipeline } = await import('@huggingface/transformers');

    this.extractor = await pipeline('feature-extraction', this.model, {
      dtype: 'fp32',
      // Force ONNX to avoid WebGPU/WebNN in Node.js
      device: 'cpu',
    });
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.extractor) {
      await this.init();
    }
  }

  /**
   * Embed a single text string into a 384-dimensional vector.
   */
  async embed(text: string): Promise<Result<readonly number[], string>> {
    try {
      await this.ensureLoaded();

      const output = await this.extractor!(text, {
        pooling: 'mean',
        normalize: true,
      });

      // output.data is a Float32Array; convert to plain number[]
      const embedding = Array.from(output.data as Float32Array);

      if (embedding.length !== this.dimensions) {
        return err(
          `OnnxEmbedder: expected ${this.dimensions} dimensions, got ${embedding.length}`,
        );
      }

      return ok(embedding);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OnnxEmbedder: embedding failed — ${message}`);
    }
  }

  /**
   * Embed multiple texts. Processes in batches of BATCH_SIZE to avoid OOM.
   */
  async embedBatch(
    texts: readonly string[],
  ): Promise<Result<readonly (readonly number[])[], string>> {
    try {
      await this.ensureLoaded();

      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);

        for (const text of batch) {
          const output = await this.extractor!(text, {
            pooling: 'mean',
            normalize: true,
          });

          const embedding = Array.from(output.data as Float32Array);

          if (embedding.length !== this.dimensions) {
            return err(
              `OnnxEmbedder: expected ${this.dimensions} dimensions, got ${embedding.length} for text at index ${i}`,
            );
          }

          results.push(embedding);
        }
      }

      return ok(results);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`OnnxEmbedder: batch embedding failed — ${message}`);
    }
  }

  /**
   * Whether the model has been loaded and is ready for inference.
   */
  get isReady(): boolean {
    return this.extractor !== null;
  }
}
