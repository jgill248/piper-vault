import { describe, it, expect, vi } from 'vitest';
import { synthesizeWikiPage } from './wiki-synthesizer';
import type { LlmProvider } from '../llm/provider';

function makeLlm(response: string): LlmProvider {
  return {
    query: vi.fn().mockResolvedValue({ ok: true, value: { content: response } }),
    queryStream: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  } as unknown as LlmProvider;
}

function makeFailingLlm(): LlmProvider {
  return {
    query: vi.fn().mockResolvedValue({ ok: false, error: 'LLM unavailable' }),
    queryStream: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  } as unknown as LlmProvider;
}

const existingContent = '# Machine Learning\n\nML is a subset of AI.\n\n## Sources\n- doc1.txt';
const metadata = { pageTitle: 'Machine Learning', pageTags: ['ai', 'ml'] as readonly string[] };

describe('synthesizeWikiPage', () => {
  it('returns synthesized content from LLM response', async () => {
    const llm = makeLlm(JSON.stringify({
      content: '# Machine Learning\n\nML is a subset of AI that also covers deep learning.\n\n## Sources\n- doc1.txt\n- doc2.txt',
      summary: 'Added deep learning information',
      changeType: 'minor_update',
    }));

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      ['source-1'],
      'Deep learning is a branch of ML.',
      'source-2',
      metadata,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toContain('deep learning');
      expect(result.value.summary).toBe('Added deep learning information');
      expect(result.value.changeType).toBe('minor_update');
      expect(result.value.mergedSourceIds).toEqual(['source-1', 'source-2']);
    }
  });

  it('accumulates and deduplicates source IDs', async () => {
    const llm = makeLlm(JSON.stringify({
      content: 'Updated content',
      summary: 'Updated',
      changeType: 'minor_update',
    }));

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      ['source-1', 'source-2'],
      'New info',
      'source-2', // duplicate
      metadata,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mergedSourceIds).toEqual(['source-1', 'source-2']);
    }
  });

  it('preserves existing content when changeType is no_change', async () => {
    const llm = makeLlm(JSON.stringify({
      content: 'This should be ignored',
      summary: 'No relevant new information',
      changeType: 'no_change',
    }));

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      ['source-1'],
      'Irrelevant content',
      'source-2',
      metadata,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe(existingContent);
      expect(result.value.changeType).toBe('no_change');
    }
  });

  it('returns error when LLM fails', async () => {
    const llm = makeFailingLlm();

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      ['source-1'],
      'New content',
      'source-2',
      metadata,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('LLM query failed');
    }
  });

  it('returns error when LLM returns unparseable response', async () => {
    const llm = makeLlm('This is not JSON');

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      ['source-1'],
      'New content',
      'source-2',
      metadata,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to parse');
    }
  });

  it('handles fenced JSON response', async () => {
    const llm = makeLlm('```json\n{"content": "Fenced", "summary": "ok", "changeType": "major_rewrite"}\n```');

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      [],
      'New content',
      'source-1',
      metadata,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe('Fenced');
      expect(result.value.changeType).toBe('major_rewrite');
    }
  });

  it('defaults changeType to minor_update for unknown values', async () => {
    const llm = makeLlm(JSON.stringify({
      content: 'Updated',
      summary: 'Updated',
      changeType: 'something_invalid',
    }));

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      [],
      'New content',
      'source-1',
      metadata,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.changeType).toBe('minor_update');
    }
  });

  it('defaults summary when LLM omits it', async () => {
    const llm = makeLlm(JSON.stringify({
      content: 'Updated content',
      changeType: 'minor_update',
    }));

    const result = await synthesizeWikiPage(
      llm,
      existingContent,
      [],
      'New content',
      'source-1',
      metadata,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toContain('Machine Learning');
    }
  });

  it('passes metadata to the prompt', async () => {
    const llm = makeLlm(JSON.stringify({ content: 'C', summary: 's', changeType: 'minor_update' }));

    await synthesizeWikiPage(
      llm,
      existingContent,
      [],
      'New source material',
      'source-1',
      metadata,
      'gpt-4',
    );

    const call = (llm.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain('Machine Learning');
    expect(call.prompt).toContain('New source material');
    expect(call.prompt).toContain(existingContent);
    expect(call.model).toBe('gpt-4');
    expect(call.maxTokens).toBe(8000);
  });
});
