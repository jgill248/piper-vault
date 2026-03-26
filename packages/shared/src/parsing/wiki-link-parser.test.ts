import { describe, it, expect } from 'vitest';
import { parseWikiLinks } from './wiki-link-parser.js';

describe('parseWikiLinks', () => {
  it('parses basic [[Page]] links', () => {
    const result = parseWikiLinks('See [[My Note]] for details.');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('My Note');
    expect(result[0]!.linkType).toBe('wiki-link');
    expect(result[0]!.displayText).toBeNull();
    expect(result[0]!.section).toBeNull();
  });

  it('parses [[Page|Alias]] links', () => {
    const result = parseWikiLinks('Check [[Meeting Notes|the notes]] here.');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('Meeting Notes');
    expect(result[0]!.displayText).toBe('the notes');
    expect(result[0]!.linkType).toBe('wiki-link');
  });

  it('parses [[Page#Section]] heading links', () => {
    const result = parseWikiLinks('See [[Architecture#Database]] for schema.');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('Architecture');
    expect(result[0]!.section).toBe('Database');
    expect(result[0]!.linkType).toBe('heading-ref');
  });

  it('parses [[Page#Section|Alias]] links', () => {
    const result = parseWikiLinks('Read [[Spec#Phase 5|the phase]] here.');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('Spec');
    expect(result[0]!.section).toBe('Phase 5');
    expect(result[0]!.displayText).toBe('the phase');
    expect(result[0]!.linkType).toBe('heading-ref');
  });

  it('parses ![[Embed]] transclude links', () => {
    const result = parseWikiLinks('Include this: ![[Diagram]]');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('Diagram');
    expect(result[0]!.linkType).toBe('embed');
  });

  it('parses multiple links in one text', () => {
    const text = 'Link to [[Alpha]] and [[Beta|b]] and ![[Gamma#Intro]]';
    const result = parseWikiLinks(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.targetFilename).toBe('Alpha');
    expect(result[1]!.targetFilename).toBe('Beta');
    expect(result[1]!.displayText).toBe('b');
    expect(result[2]!.targetFilename).toBe('Gamma');
    expect(result[2]!.section).toBe('Intro');
    expect(result[2]!.linkType).toBe('embed');
  });

  it('excludes links inside fenced code blocks', () => {
    const text = `Before [[Real Link]]

\`\`\`markdown
This [[Fake Link]] is in a code block
\`\`\`

After [[Another Real Link]]`;

    const result = parseWikiLinks(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.targetFilename).toBe('Real Link');
    expect(result[1]!.targetFilename).toBe('Another Real Link');
  });

  it('excludes links inside inline code', () => {
    const text = 'Use `[[not a link]]` but [[real link]] is parsed.';
    const result = parseWikiLinks(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('real link');
  });

  it('returns empty array for text with no links', () => {
    const result = parseWikiLinks('No wiki links here.');
    expect(result).toEqual([]);
  });

  it('handles empty link targets gracefully', () => {
    const result = parseWikiLinks('Empty [[]] link.');
    // Empty inner content — should still parse but with empty filename
    // The regex requires at least one char, so this should not match
    expect(result).toHaveLength(0);
  });

  it('records correct positions', () => {
    const text = 'Start [[Link]] end';
    const result = parseWikiLinks(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.position.start).toBe(6);
    expect(result[0]!.position.end).toBe(14);
    expect(text.slice(result[0]!.position.start, result[0]!.position.end)).toBe(
      '[[Link]]',
    );
  });

  it('handles links with spaces and special characters', () => {
    const result = parseWikiLinks('See [[2026-03-23 Meeting Notes]].');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('2026-03-23 Meeting Notes');
  });

  it('handles embed with section', () => {
    const result = parseWikiLinks('![[File#Section]]');

    expect(result).toHaveLength(1);
    expect(result[0]!.targetFilename).toBe('File');
    expect(result[0]!.section).toBe('Section');
    expect(result[0]!.linkType).toBe('embed');
  });
});
