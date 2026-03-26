/**
 * Downloads and caches the Xenova/all-MiniLM-L6-v2 ONNX embedding model.
 * Run during Docker build to bake the model into the image so it's
 * available instantly at runtime with no network call needed.
 */
import { pipeline } from '@huggingface/transformers';

console.log('[download-model] Downloading Xenova/all-MiniLM-L6-v2...');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
  dtype: 'fp32',
  device: 'cpu',
});

// Verify the model works with a test embedding
const output = await extractor('test', { pooling: 'mean', normalize: true });
console.log(`[download-model] Model cached successfully. Embedding dimensions: ${output.dims[1]}`);
process.exit(0);
