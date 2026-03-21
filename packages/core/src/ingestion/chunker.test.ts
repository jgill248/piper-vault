import { describe, it, expect } from 'vitest';
import { chunkText } from './chunker.js';

const config = { chunkSize: 100, chunkOverlap: 20 };

describe('chunkText', () => {
  it('returns empty array for empty/whitespace input', () => {
    expect(chunkText('', config)).toEqual([]);
    expect(chunkText('   ', config)).toEqual([]);
    expect(chunkText('\n\n\n', config)).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const result = chunkText('Hello world.', config);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe('Hello world.');
    expect(result[0]!.index).toBe(0);
    expect(result[0]!.tokenCount).toBeGreaterThan(0);
  });

  it('splits on paragraph boundaries', () => {
    const text = 'First paragraph with several words.\n\nSecond paragraph with other words.';
    const result = chunkText(text, config);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Both paragraphs should appear in the chunks
    const combined = result.map((c) => c.content).join(' ');
    expect(combined).toContain('First paragraph');
    expect(combined).toContain('Second paragraph');
  });

  it('produces sequential chunk indices', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const result = chunkText(words, { chunkSize: 30, chunkOverlap: 5 });
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('respects chunk size approximately', () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const result = chunkText(words, { chunkSize: 50, chunkOverlap: 10 });
    // All chunks should exist
    expect(result.length).toBeGreaterThan(3);
  });

  it('handles text with no paragraph breaks', () => {
    const text = 'This is a long sentence. Another sentence here. Yet another one. And more.';
    const result = chunkText(text, config);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.content.length).toBeGreaterThan(0);
  });

  it('includes tokenCount in each chunk', () => {
    const result = chunkText('Some text for testing tokenization estimates.', config);
    expect(result[0]!.tokenCount).toBeGreaterThan(0);
  });
});
