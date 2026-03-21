import { describe, it, expect, vi } from 'vitest';
import { LlmReranker } from './llm-reranker.js';
import type { LlmProvider, LlmQuery, LlmResponse } from '../llm/provider.js';
import type { ChunkSearchResult } from '@delve/shared';
import { ok, err } from '@delve/shared';

function makeChunk(id: string, content: string, filename: string): ChunkSearchResult {
  return {
    chunk: {
      id,
      sourceId: 'src-1',
      chunkIndex: 0,
      content,
      tokenCount: 10,
      pageNumber: undefined,
      metadata: {},
      createdAt: new Date('2025-01-01'),
    },
    score: 0.8,
    source: {
      id: 'src-1',
      filename,
      fileType: 'text/plain',
    },
  };
}

function makeMockLlm(response: string | null): LlmProvider {
  return {
    query: vi.fn(async (_input: LlmQuery) => {
      if (response === null) {
        return err('LLM unavailable');
      }
      const llmResponse: LlmResponse = {
        content: response,
        model: 'test-model',
        tokensUsed: 50,
      };
      return ok(llmResponse);
    }),
    getModels: vi.fn(async () => ok(['test-model'] as readonly string[])),
  };
}

describe('LlmReranker', () => {
  const candidates = [
    makeChunk('c1', 'Relevant content about the topic', 'doc1.txt'),
    makeChunk('c2', 'Somewhat related information here', 'doc2.txt'),
    makeChunk('c3', 'Completely unrelated content', 'doc3.txt'),
    makeChunk('c4', 'Another relevant piece of information', 'doc4.txt'),
    makeChunk('c5', 'Tangentially related data', 'doc5.txt'),
  ];

  it('returns all candidates when count is less than or equal to topN', async () => {
    const llm = makeMockLlm('[{"index": 0, "score": 9}]');
    const reranker = new LlmReranker(llm);

    const result = await reranker.rerank('test query', candidates.slice(0, 3), 5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(llm.query).not.toHaveBeenCalled();
  });

  it('returns topN candidates reordered by LLM score', async () => {
    // LLM says: index 2 is most relevant, then 0, then 1 — rest get 0
    const llmJson = JSON.stringify([
      { index: 2, score: 9 },
      { index: 0, score: 7 },
      { index: 1, score: 5 },
      { index: 3, score: 3 },
      { index: 4, score: 1 },
    ]);
    const llm = makeMockLlm(llmJson);
    const reranker = new LlmReranker(llm);

    const result = await reranker.rerank('test query', candidates, 3);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(result.value[0]!.chunk.id).toBe('c3'); // index 2
    expect(result.value[1]!.chunk.id).toBe('c1'); // index 0
    expect(result.value[2]!.chunk.id).toBe('c2'); // index 1
  });

  it('handles LLM failure gracefully by returning original order truncated', async () => {
    const llm = makeMockLlm(null);
    const reranker = new LlmReranker(llm);

    const result = await reranker.rerank('test query', candidates, 3);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    // Should return first 3 in original order
    expect(result.value[0]!.chunk.id).toBe('c1');
    expect(result.value[1]!.chunk.id).toBe('c2');
    expect(result.value[2]!.chunk.id).toBe('c3');
  });

  it('handles invalid JSON gracefully by returning original order truncated', async () => {
    const llm = makeMockLlm('this is not valid json at all');
    const reranker = new LlmReranker(llm);

    const result = await reranker.rerank('test query', candidates, 3);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(result.value[0]!.chunk.id).toBe('c1');
    expect(result.value[1]!.chunk.id).toBe('c2');
    expect(result.value[2]!.chunk.id).toBe('c3');
  });

  it('handles LLM response with JSON wrapped in markdown code block', async () => {
    const llmJson = '```json\n' + JSON.stringify([
      { index: 1, score: 10 },
      { index: 0, score: 5 },
      { index: 2, score: 2 },
      { index: 3, score: 1 },
      { index: 4, score: 0 },
    ]) + '\n```';
    const llm = makeMockLlm(llmJson);
    const reranker = new LlmReranker(llm);

    const result = await reranker.rerank('test query', candidates, 2);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]!.chunk.id).toBe('c2'); // index 1, score 10
    expect(result.value[1]!.chunk.id).toBe('c1'); // index 0, score 5
  });

  it('handles missing indices in LLM response by assigning score 0', async () => {
    // LLM only scores some items; the rest default to 0
    const llmJson = JSON.stringify([{ index: 4, score: 8 }]);
    const llm = makeMockLlm(llmJson);
    const reranker = new LlmReranker(llm);

    const result = await reranker.rerank('test query', candidates, 2);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Index 4 (c5) should be first since it has the only non-zero score
    expect(result.value[0]!.chunk.id).toBe('c5');
  });
});
