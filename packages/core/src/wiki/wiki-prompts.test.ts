import { describe, it, expect } from 'vitest';
import {
  buildWikiIngestPrompt,
  buildWikiPromotePrompt,
  buildWikiLintPrompt,
  buildWikiIndexPrompt,
  buildWikiSynthesizePrompt,
  WIKI_INGEST_SYSTEM_PROMPT,
  WIKI_PROMOTE_SYSTEM_PROMPT,
  WIKI_LINT_SYSTEM_PROMPT,
  WIKI_INDEX_SYSTEM_PROMPT,
  WIKI_SYNTHESIZE_SYSTEM_PROMPT,
} from './wiki-prompts';

describe('wiki prompts', () => {
  describe('system prompts', () => {
    it('all system prompts are non-empty strings', () => {
      expect(WIKI_INGEST_SYSTEM_PROMPT.length).toBeGreaterThan(50);
      expect(WIKI_PROMOTE_SYSTEM_PROMPT.length).toBeGreaterThan(50);
      expect(WIKI_LINT_SYSTEM_PROMPT.length).toBeGreaterThan(50);
      expect(WIKI_INDEX_SYSTEM_PROMPT.length).toBeGreaterThan(20);
      expect(WIKI_SYNTHESIZE_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    });

    it('all system prompts request JSON output', () => {
      expect(WIKI_INGEST_SYSTEM_PROMPT).toContain('JSON');
      expect(WIKI_PROMOTE_SYSTEM_PROMPT).toContain('JSON');
      expect(WIKI_LINT_SYSTEM_PROMPT).toContain('JSON');
      expect(WIKI_INDEX_SYSTEM_PROMPT).toContain('JSON');
      expect(WIKI_SYNTHESIZE_SYSTEM_PROMPT).toContain('JSON');
    });
  });

  describe('buildWikiIngestPrompt', () => {
    it('includes source filename and content', () => {
      const prompt = buildWikiIngestPrompt('doc.pdf', 'The quick brown fox', [], 5);
      expect(prompt).toContain('doc.pdf');
      expect(prompt).toContain('The quick brown fox');
      expect(prompt).toContain('up to 5');
    });

    it('includes existing page titles when provided', () => {
      const prompt = buildWikiIngestPrompt('f.txt', 'body', ['Page A', 'Page B'], 10);
      expect(prompt).toContain('[[Page A]]');
      expect(prompt).toContain('[[Page B]]');
    });

    it('shows "No existing wiki pages" when list is empty', () => {
      const prompt = buildWikiIngestPrompt('f.txt', 'body', [], 10);
      expect(prompt).toContain('No existing wiki pages');
    });

    it('includes the expected JSON schema', () => {
      const prompt = buildWikiIngestPrompt('f.txt', 'body', [], 1);
      expect(prompt).toContain('"pages"');
      expect(prompt).toContain('"updatedPages"');
      expect(prompt).toContain('"summary"');
    });
  });

  describe('buildWikiPromotePrompt', () => {
    it('includes conversation transcript', () => {
      const messages = [
        { role: 'user', content: 'What is React?' },
        { role: 'assistant', content: 'React is a library.' },
      ];
      const prompt = buildWikiPromotePrompt(messages, []);
      expect(prompt).toContain('User: What is React?');
      expect(prompt).toContain('Assistant: React is a library.');
    });

    it('includes existing titles', () => {
      const prompt = buildWikiPromotePrompt(
        [{ role: 'user', content: 'q' }],
        ['Existing Topic'],
      );
      expect(prompt).toContain('[[Existing Topic]]');
    });

    it('omits existing section when no titles', () => {
      const prompt = buildWikiPromotePrompt(
        [{ role: 'user', content: 'q' }],
        [],
      );
      expect(prompt).not.toContain('Existing wiki pages');
    });
  });

  describe('buildWikiLintPrompt', () => {
    it('includes page titles and content', () => {
      const pages = [
        { title: 'Page A', content: 'Content A' },
        { title: 'Page B', content: 'Content B' },
      ];
      const prompt = buildWikiLintPrompt(pages);
      expect(prompt).toContain('## Page A');
      expect(prompt).toContain('Content A');
      expect(prompt).toContain('## Page B');
      expect(prompt).toContain('Content B');
    });

    it('includes expected JSON schema', () => {
      const prompt = buildWikiLintPrompt([{ title: 'X', content: 'Y' }]);
      expect(prompt).toContain('"issues"');
      expect(prompt).toContain('"type"');
      expect(prompt).toContain('"severity"');
    });
  });

  describe('buildWikiSynthesizePrompt', () => {
    it('includes page title and existing content', () => {
      const prompt = buildWikiSynthesizePrompt(
        'Machine Learning',
        '# ML\n\nML overview.',
        ['ai', 'ml'],
        'Deep learning extends ML.',
        'doc2.pdf',
      );
      expect(prompt).toContain('Machine Learning');
      expect(prompt).toContain('ML overview.');
      expect(prompt).toContain('ai, ml');
    });

    it('includes new source content and filename', () => {
      const prompt = buildWikiSynthesizePrompt(
        'Topic',
        'Existing',
        [],
        'New source material here',
        'source.txt',
      );
      expect(prompt).toContain('New source material here');
      expect(prompt).toContain('source.txt');
    });

    it('includes expected JSON schema', () => {
      const prompt = buildWikiSynthesizePrompt('T', 'C', [], 'S', 'f.txt');
      expect(prompt).toContain('"content"');
      expect(prompt).toContain('"summary"');
      expect(prompt).toContain('"changeType"');
    });

    it('omits tag line when no tags', () => {
      const prompt = buildWikiSynthesizePrompt('T', 'C', [], 'S', 'f.txt');
      expect(prompt).not.toContain('Tags:');
    });
  });

  describe('buildWikiIndexPrompt', () => {
    it('includes page metadata', () => {
      const pages = [
        { title: 'React', tags: ['tech', 'frontend'] as const, summary: 'A JS library' },
      ];
      const prompt = buildWikiIndexPrompt(pages);
      expect(prompt).toContain('React');
      expect(prompt).toContain('tech, frontend');
      expect(prompt).toContain('A JS library');
    });

    it('includes expected JSON schema', () => {
      const prompt = buildWikiIndexPrompt([
        { title: 'T', tags: [] as const, summary: 'S' },
      ]);
      expect(prompt).toContain('"categories"');
      expect(prompt).toContain('"name"');
    });
  });
});
