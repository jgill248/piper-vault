import { describe, it, expect, vi } from 'vitest';
import { runStructuralLint, runSemanticLint } from './wiki-linter';
import type { BrokenLink, OrphanedPage } from './wiki-linter';
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
// runStructuralLint
// ---------------------------------------------------------------------------

describe('runStructuralLint', () => {
  it('returns empty issues when no problems exist', () => {
    const issues = runStructuralLint([], [], []);
    expect(issues).toEqual([]);
  });

  it('reports broken links', () => {
    const brokenLinks: BrokenLink[] = [
      { sourcePageTitle: 'Page A', targetFilename: 'Missing Page' },
    ];

    const issues = runStructuralLint(brokenLinks, [], []);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('broken_link');
    expect(issues[0].severity).toBe('medium');
    expect(issues[0].description).toContain('Page A');
    expect(issues[0].description).toContain('Missing Page');
    expect(issues[0].affectedPages).toEqual(['Page A']);
  });

  it('reports orphaned pages', () => {
    const orphans: OrphanedPage[] = [
      { title: 'Lonely Page', sourceId: 'id-1' },
    ];

    const issues = runStructuralLint([], orphans, []);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('orphaned');
    expect(issues[0].severity).toBe('low');
    expect(issues[0].description).toContain('Lonely Page');
  });

  it('reports stale pages', () => {
    const stalePages = [
      { title: 'Old Page', sourceId: 'id-2', reason: 'Source updated' },
    ];

    const issues = runStructuralLint([], [], stalePages);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('stale');
    expect(issues[0].severity).toBe('medium');
    expect(issues[0].description).toContain('Old Page');
    expect(issues[0].suggestedFix).toContain('Re-generate');
  });

  it('reports all issue types combined', () => {
    const brokenLinks: BrokenLink[] = [
      { sourcePageTitle: 'A', targetFilename: 'B' },
    ];
    const orphans: OrphanedPage[] = [
      { title: 'C', sourceId: '1' },
    ];
    const stale = [
      { title: 'D', sourceId: '2', reason: 'outdated' },
    ];

    const issues = runStructuralLint(brokenLinks, orphans, stale);

    expect(issues).toHaveLength(3);
    expect(issues.map((i) => i.type)).toEqual(['broken_link', 'orphaned', 'stale']);
  });

  it('includes correct suggestedFix for broken links', () => {
    const issues = runStructuralLint(
      [{ sourcePageTitle: 'Page X', targetFilename: 'Target Y' }],
      [],
      [],
    );

    expect(issues[0].suggestedFix).toContain('Target Y');
  });
});

// ---------------------------------------------------------------------------
// runSemanticLint
// ---------------------------------------------------------------------------

describe('runSemanticLint', () => {
  it('returns empty array for empty page list', async () => {
    const llm = makeLlm('{}');
    const result = await runSemanticLint(llm, []);
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('parses semantic issues from LLM response', async () => {
    const llm = makeLlm(JSON.stringify({
      issues: [
        {
          type: 'contradiction',
          severity: 'high',
          description: 'Page A says X, Page B says Y',
          affectedPages: ['Page A', 'Page B'],
          suggestedFix: 'Reconcile the two claims',
        },
      ],
    }));

    const pages = [
      { title: 'Page A', content: 'X is true' },
      { title: 'Page B', content: 'Y is true' },
    ];

    const result = await runSemanticLint(llm, pages);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].type).toBe('contradiction');
      expect(result.value[0].severity).toBe('high');
      expect(result.value[0].affectedPages).toEqual(['Page A', 'Page B']);
    }
  });

  it('handles fenced JSON in LLM response', async () => {
    const llm = makeLlm('```json\n{"issues": [{"type": "incomplete", "severity": "low", "description": "d", "affectedPages": ["P"], "suggestedFix": "f"}]}\n```');

    const result = await runSemanticLint(llm, [{ title: 'P', content: 'c' }]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });

  it('returns error when LLM fails', async () => {
    const llm = makeFailingLlm();

    const result = await runSemanticLint(llm, [{ title: 'A', content: 'c' }]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('LLM lint query failed');
    }
  });

  it('handles LLM returning no issues', async () => {
    const llm = makeLlm(JSON.stringify({ issues: [] }));

    const result = await runSemanticLint(llm, [{ title: 'A', content: 'c' }]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('batches pages when over BATCH_SIZE', async () => {
    const pages = Array.from({ length: 25 }, (_, i) => ({
      title: `Page ${i}`,
      content: `Content ${i}`,
    }));

    const llm = makeLlm(JSON.stringify({ issues: [] }));

    const result = await runSemanticLint(llm, pages);

    expect(result.ok).toBe(true);
    // Should have been called twice: batch of 20 + batch of 5
    expect((llm.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('continues processing when one batch has unparseable response', async () => {
    const llm = {
      query: vi.fn()
        .mockResolvedValueOnce({ ok: true, value: { content: 'not json' } })
        .mockResolvedValueOnce({ ok: true, value: { content: JSON.stringify({
          issues: [{ type: 'incomplete', severity: 'low', description: 'd', affectedPages: ['P'], suggestedFix: 'f' }],
        }) } }),
      queryStream: vi.fn(),
      listModels: vi.fn().mockResolvedValue([]),
    } as unknown as LlmProvider;

    const pages = Array.from({ length: 25 }, (_, i) => ({
      title: `Page ${i}`,
      content: `Content ${i}`,
    }));

    const result = await runSemanticLint(llm, pages);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Only issues from the second batch (first batch parse failed silently)
      expect(result.value).toHaveLength(1);
    }
  });
});
