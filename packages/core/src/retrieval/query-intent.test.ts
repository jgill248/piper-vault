import { describe, it, expect } from 'vitest';
import { detectQueryIntent } from './query-intent.js';

// Fixed reference date: Wednesday 2026-03-25 14:30:00
const NOW = new Date('2026-03-25T14:30:00.000Z');

describe('detectQueryIntent', () => {
  describe('semantic (default)', () => {
    it('returns semantic for regular content queries', () => {
      const result = detectQueryIntent('what is retrieval augmented generation', NOW);
      expect(result.type).toBe('semantic');
      expect(result.temporal).toBeUndefined();
    });

    it('returns semantic for queries without temporal keywords', () => {
      const result = detectQueryIntent('how does the API work', NOW);
      expect(result.type).toBe('semantic');
    });
  });

  describe('metadata (temporal + notes)', () => {
    it('detects "what notes did I create today"', () => {
      const result = detectQueryIntent('what notes did I create today', NOW);
      expect(result.type).toBe('metadata');
      expect(result.wantsNotes).toBe(true);
      expect(result.dateLabel).toBe('today');
      expect(result.temporal).toBeDefined();
      expect(result.temporal!.dateFrom).toContain('2026-03-25');
      expect(result.temporal!.dateTo).toContain('2026-03-25');
    });

    it('detects "show my notes from yesterday"', () => {
      const result = detectQueryIntent('show my notes from yesterday', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('yesterday');
      expect(result.temporal).toBeDefined();
      expect(result.temporal!.dateFrom).toContain('2026-03-24');
      expect(result.temporal!.dateTo).toContain('2026-03-24');
    });

    it('detects "list notes from this week"', () => {
      const result = detectQueryIntent('list notes from this week', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('this week');
      // 2026-03-25 is a Wednesday; Monday = 2026-03-23
      expect(result.temporal!.dateFrom).toContain('2026-03-23');
    });

    it('detects "notes from last week"', () => {
      const result = detectQueryIntent('notes from last week', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('last week');
    });

    it('detects "notes from the past 3 days"', () => {
      const result = detectQueryIntent('notes from the past 3 days', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('past 3 days');
      expect(result.temporal!.dateFrom).toContain('2026-03-22');
    });

    it('detects "notes from last 7 days"', () => {
      const result = detectQueryIntent('notes from last 7 days', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('past 7 days');
    });

    it('detects "this month notes"', () => {
      const result = detectQueryIntent('this month notes', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('this month');
      expect(result.temporal!.dateFrom).toContain('2026-03-01');
    });

    it('detects "last month notes"', () => {
      const result = detectQueryIntent('last month notes', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('last month');
      expect(result.temporal!.dateFrom).toContain('2026-02-01');
      expect(result.temporal!.dateTo).toContain('2026-02-28');
    });
  });

  describe('hybrid (temporal + content)', () => {
    it('detects "notes from yesterday about API design"', () => {
      const result = detectQueryIntent('notes from yesterday about API design', NOW);
      expect(result.type).toBe('hybrid');
      expect(result.dateLabel).toBe('yesterday');
      expect(result.contentQuery).toBeTruthy();
      expect(result.contentQuery!.toLowerCase()).toContain('api');
      expect(result.contentQuery!.toLowerCase()).toContain('design');
    });

    it('detects "summarize notes from this week about the project"', () => {
      const result = detectQueryIntent(
        'summarize notes from this week about the project',
        NOW,
      );
      expect(result.type).toBe('hybrid');
      expect(result.dateLabel).toBe('this week');
      expect(result.contentQuery).toBeTruthy();
      expect(result.contentQuery!.toLowerCase()).toContain('project');
    });
  });

  describe('date field detection', () => {
    it('uses created_at by default', () => {
      const result = detectQueryIntent('what notes did I create today', NOW);
      expect(result.dateField).toBe('created_at');
    });

    it('uses updated_at when "updated" is in query', () => {
      const result = detectQueryIntent('notes updated today', NOW);
      expect(result.dateField).toBe('updated_at');
    });

    it('uses updated_at when "modified" is in query', () => {
      const result = detectQueryIntent('notes modified yesterday', NOW);
      expect(result.dateField).toBe('updated_at');
    });

    it('uses updated_at when "edited" is in query', () => {
      const result = detectQueryIntent('notes I edited this week', NOW);
      expect(result.dateField).toBe('updated_at');
    });
  });

  describe('temporal without note keywords', () => {
    it('still detects temporal intent without "notes" keyword', () => {
      const result = detectQueryIntent('what did I write today', NOW);
      expect(result.type).toBe('metadata');
      expect(result.temporal).toBeDefined();
      expect(result.dateLabel).toBe('today');
      // wantsNotes should be false since "notes" isn't in the query
      expect(result.wantsNotes).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty query', () => {
      const result = detectQueryIntent('', NOW);
      expect(result.type).toBe('semantic');
    });

    it('handles query with only temporal keyword', () => {
      const result = detectQueryIntent('today', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('today');
    });

    it('is case insensitive', () => {
      const result = detectQueryIntent('What Notes Did I Create TODAY', NOW);
      expect(result.type).toBe('metadata');
      expect(result.dateLabel).toBe('today');
    });
  });
});
