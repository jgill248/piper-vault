import { describe, it, expect, vi } from 'vitest';
import { generateWikiIndex } from './wiki-index-generator';
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

describe('generateWikiIndex', () => {
  it('returns empty categories for empty page list', async () => {
    const llm = makeLlm('{}');
    const result = await generateWikiIndex(llm, []);
    expect(result).toEqual({ ok: true, value: { categories: [] } });
    // Should not call the LLM at all
    expect((llm.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('parses categorized index from LLM response', async () => {
    const llm = makeLlm(JSON.stringify({
      categories: [
        {
          name: 'Technology',
          pages: [
            { title: 'React', summary: 'A JS library' },
            { title: 'Node.js', summary: 'A runtime' },
          ],
        },
        {
          name: 'Science',
          pages: [
            { title: 'Physics', summary: 'Study of matter' },
          ],
        },
      ],
    }));

    const pages = [
      { title: 'React', tags: ['tech'] as const, summary: 'A JS library' },
      { title: 'Node.js', tags: ['tech'] as const, summary: 'A runtime' },
      { title: 'Physics', tags: ['science'] as const, summary: 'Study of matter' },
    ];

    const result = await generateWikiIndex(llm, pages);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.categories).toHaveLength(2);
      expect(result.value.categories[0].name).toBe('Technology');
      expect(result.value.categories[0].pages).toHaveLength(2);
      expect(result.value.categories[1].name).toBe('Science');
    }
  });

  it('handles fenced JSON response', async () => {
    const llm = makeLlm('```json\n{"categories": [{"name": "All", "pages": [{"title": "T", "summary": "S"}]}]}\n```');

    const result = await generateWikiIndex(llm, [
      { title: 'T', tags: [] as const, summary: 'S' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.categories).toHaveLength(1);
    }
  });

  it('returns error when LLM fails', async () => {
    const llm = makeFailingLlm();

    const result = await generateWikiIndex(llm, [
      { title: 'A', tags: [] as const, summary: 'x' },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('LLM index query failed');
    }
  });

  it('returns error when LLM returns unparseable response', async () => {
    const llm = makeLlm('This is plain text, not JSON');

    const result = await generateWikiIndex(llm, [
      { title: 'A', tags: [] as const, summary: 'x' },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to parse');
    }
  });

  it('passes page metadata to the prompt', async () => {
    const llm = makeLlm(JSON.stringify({ categories: [] }));

    await generateWikiIndex(llm, [
      { title: 'My Page', tags: ['tag1', 'tag2'] as const, summary: 'A summary' },
    ], 'gpt-4');

    const call = (llm.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain('My Page');
    expect(call.prompt).toContain('tag1');
    expect(call.prompt).toContain('A summary');
    expect(call.model).toBe('gpt-4');
  });
});
