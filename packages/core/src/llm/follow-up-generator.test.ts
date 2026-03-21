import { describe, it, expect, vi } from 'vitest';
import type { LlmProvider } from './provider.js';
import type { ChunkSearchResult } from '@delve/shared';
import { generateFollowUpQuestions } from './follow-up-generator.js';

function makeMockLlm(responseContent: string): LlmProvider {
  return {
    query: vi.fn().mockResolvedValue({ ok: true, value: { content: responseContent, model: 'mock' } }),
    getModels: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  };
}

function makeFailingLlm(): LlmProvider {
  return {
    query: vi.fn().mockResolvedValue({ ok: false, error: 'LLM unavailable' }),
    getModels: vi.fn().mockResolvedValue({ ok: false, error: 'LLM unavailable' }),
  };
}

function makeChunkResult(filename: string): ChunkSearchResult {
  return {
    source: { id: '1', filename, fileType: 'text/plain' },
    chunk: {
      id: '1',
      sourceId: '1',
      chunkIndex: 0,
      content: 'Some content',
      tokenCount: 10,
      metadata: {},
      createdAt: new Date(),
    },
    score: 0.9,
  };
}

describe('generateFollowUpQuestions', () => {
  it('returns parsed questions when LLM returns valid JSON array', async () => {
    const llm = makeMockLlm('["What is the summary?", "Can you elaborate?", "What are the implications?"]');
    const result = await generateFollowUpQuestions(llm, 'Tell me about AI', 'AI is great', [], 3);
    expect(result).toEqual(['What is the summary?', 'Can you elaborate?', 'What are the implications?']);
  });

  it('returns empty array when LLM fails', async () => {
    const llm = makeFailingLlm();
    const result = await generateFollowUpQuestions(llm, 'Tell me about AI', 'AI is great', []);
    expect(result).toEqual([]);
  });

  it('returns empty array on invalid JSON', async () => {
    const llm = makeMockLlm('This is not JSON at all');
    const result = await generateFollowUpQuestions(llm, 'Tell me about AI', 'AI is great', []);
    expect(result).toEqual([]);
  });

  it('returns empty array when JSON is not an array', async () => {
    const llm = makeMockLlm('{"question": "What is AI?"}');
    const result = await generateFollowUpQuestions(llm, 'Tell me about AI', 'AI is great', []);
    expect(result).toEqual([]);
  });

  it('limits returned questions to the count parameter', async () => {
    const llm = makeMockLlm('["Q1?", "Q2?", "Q3?", "Q4?", "Q5?"]');
    const result = await generateFollowUpQuestions(llm, 'query', 'answer', [], 2);
    expect(result).toHaveLength(2);
    expect(result).toEqual(['Q1?', 'Q2?']);
  });

  it('handles JSON wrapped in markdown code blocks', async () => {
    const llm = makeMockLlm('```json\n["What else?", "How so?", "Why?"]\n```');
    const result = await generateFollowUpQuestions(llm, 'query', 'answer', [], 3);
    expect(result).toEqual(['What else?', 'How so?', 'Why?']);
  });

  it('includes source filenames in the prompt', async () => {
    const llm = makeMockLlm('["Q1?", "Q2?", "Q3?"]');
    const context = [makeChunkResult('notes.md'), makeChunkResult('research.pdf')];
    await generateFollowUpQuestions(llm, 'query', 'answer', context, 3);
    const callArg = (llm.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.prompt).toContain('notes.md');
    expect(callArg.prompt).toContain('research.pdf');
  });

  it('deduplicates source names in the prompt', async () => {
    const llm = makeMockLlm('["Q1?", "Q2?", "Q3?"]');
    const context = [makeChunkResult('notes.md'), makeChunkResult('notes.md')];
    await generateFollowUpQuestions(llm, 'query', 'answer', context, 3);
    const callArg = (llm.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // notes.md should only appear once
    const occurrences = (callArg.prompt.match(/notes\.md/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('filters out non-string array elements', async () => {
    const llm = makeMockLlm('["Valid question?", 42, null, "Another question?"]');
    const result = await generateFollowUpQuestions(llm, 'query', 'answer', [], 4);
    expect(result).toEqual(['Valid question?', 'Another question?']);
  });
});
