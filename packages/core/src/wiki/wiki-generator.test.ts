import { describe, it, expect, vi } from 'vitest';
import { generateWikiPages, promoteConversationToWiki, parseJsonResponse } from './wiki-generator';
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

// ---------------------------------------------------------------------------
// parseJsonResponse
// ---------------------------------------------------------------------------

describe('parseJsonResponse', () => {
  it('parses plain JSON', () => {
    const result = parseJsonResponse<{ x: number }>('{"x": 42}');
    expect(result).toEqual({ ok: true, value: { x: 42 } });
  });

  it('strips ```json fences', () => {
    const result = parseJsonResponse<{ x: number }>('```json\n{"x": 42}\n```');
    expect(result).toEqual({ ok: true, value: { x: 42 } });
  });

  it('strips ``` fences without language hint', () => {
    const result = parseJsonResponse<{ a: string }>('```\n{"a":"b"}\n```');
    expect(result).toEqual({ ok: true, value: { a: 'b' } });
  });

  it('returns error for invalid JSON', () => {
    const result = parseJsonResponse<unknown>('not json at all');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to parse');
    }
  });

  it('handles whitespace-padded input', () => {
    const result = parseJsonResponse<{ v: boolean }>('  \n  {"v": true}  \n  ');
    expect(result).toEqual({ ok: true, value: { v: true } });
  });
});

// ---------------------------------------------------------------------------
// generateWikiPages
// ---------------------------------------------------------------------------

describe('generateWikiPages', () => {
  it('returns parsed pages from LLM response', async () => {
    const llm = makeLlm(JSON.stringify({
      pages: [
        { title: 'Concept A', content: '# Concept A\n\nDetails...', tags: ['ai'] },
      ],
      updatedPages: [],
      summary: 'Generated 1 page from doc.txt',
    }));

    const result = await generateWikiPages(llm, 'doc.txt', 'Some content', [], 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pages).toHaveLength(1);
      expect(result.value.pages[0].title).toBe('Concept A');
      expect(result.value.pages[0].tags).toEqual(['ai']);
      expect(result.value.updatedPages).toHaveLength(0);
      expect(result.value.summary).toBe('Generated 1 page from doc.txt');
    }
  });

  it('handles response with updatedPages', async () => {
    const llm = makeLlm(JSON.stringify({
      pages: [],
      updatedPages: [
        { title: 'Existing', appendContent: 'New info', reason: 'Updated data' },
      ],
      summary: 'Updated 1 page',
    }));

    const result = await generateWikiPages(llm, 'doc.txt', 'Content', ['Existing'], 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.updatedPages).toHaveLength(1);
      expect(result.value.updatedPages[0].title).toBe('Existing');
      expect(result.value.updatedPages[0].appendContent).toBe('New info');
    }
  });

  it('handles fenced JSON response from LLM', async () => {
    const llm = makeLlm('```json\n{"pages": [{"title": "T", "content": "C"}], "summary": "ok"}\n```');

    const result = await generateWikiPages(llm, 'f.txt', 'content', [], 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pages).toHaveLength(1);
      expect(result.value.pages[0].tags).toEqual([]); // defaults to empty
    }
  });

  it('returns error when LLM fails', async () => {
    const llm = makeFailingLlm();

    const result = await generateWikiPages(llm, 'doc.txt', 'content', [], 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('LLM query failed');
    }
  });

  it('returns error when LLM returns unparseable response', async () => {
    const llm = makeLlm('This is not JSON at all.');

    const result = await generateWikiPages(llm, 'doc.txt', 'content', [], 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to parse');
    }
  });

  it('provides default summary when LLM omits it', async () => {
    const llm = makeLlm(JSON.stringify({
      pages: [{ title: 'P', content: 'C' }],
    }));

    const result = await generateWikiPages(llm, 'source.md', 'content', [], 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toContain('source.md');
    }
  });

  it('passes existing titles and maxPages to the prompt', async () => {
    const llm = makeLlm(JSON.stringify({ pages: [], summary: 'ok' }));

    await generateWikiPages(llm, 'f.txt', 'body', ['Page A', 'Page B'], 3, 'gpt-4');

    const call = (llm.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain('Page A');
    expect(call.prompt).toContain('Page B');
    expect(call.prompt).toContain('up to 3');
    expect(call.model).toBe('gpt-4');
  });
});

// ---------------------------------------------------------------------------
// promoteConversationToWiki
// ---------------------------------------------------------------------------

describe('promoteConversationToWiki', () => {
  it('returns a wiki page from conversation messages', async () => {
    const llm = makeLlm(JSON.stringify({
      title: 'How Authentication Works',
      content: '# Authentication\n\nDetails...',
      tags: ['auth', 'security'],
      summary: 'Promoted conversation about auth',
    }));

    const messages = [
      { role: 'user', content: 'How does auth work?' },
      { role: 'assistant', content: 'Auth uses JWT tokens...' },
    ];

    const result = await promoteConversationToWiki(llm, messages, []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('How Authentication Works');
      expect(result.value.content).toContain('Authentication');
      expect(result.value.tags).toEqual(['auth', 'security']);
    }
  });

  it('returns error when LLM fails', async () => {
    const llm = makeFailingLlm();

    const result = await promoteConversationToWiki(
      llm,
      [{ role: 'user', content: 'test' }],
      [],
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('LLM query failed');
    }
  });

  it('defaults tags and summary when LLM omits them', async () => {
    const llm = makeLlm(JSON.stringify({
      title: 'Test Page',
      content: 'Content here',
    }));

    const result = await promoteConversationToWiki(
      llm,
      [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }],
      [],
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tags).toEqual([]);
      expect(result.value.summary).toContain('Test Page');
    }
  });

  it('includes existing titles in the prompt', async () => {
    const llm = makeLlm(JSON.stringify({ title: 'T', content: 'C' }));

    await promoteConversationToWiki(
      llm,
      [{ role: 'user', content: 'q' }],
      ['Existing Page'],
      'claude-3',
    );

    const call = (llm.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain('Existing Page');
    expect(call.model).toBe('claude-3');
  });
});
