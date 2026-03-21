import type { AppConfig } from '@delve/shared';

export interface TextChunk {
  readonly content: string;
  readonly index: number;
  readonly tokenCount: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Approximates token count using a word-based heuristic.
 * ~0.75 tokens per word is a reasonable average for English prose.
 */
function approximateTokenCount(text: string): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  return Math.ceil(words.length / 0.75);
}

/**
 * Splits text into sentences on common sentence-ending punctuation.
 */
function splitIntoSentences(text: string): readonly string[] {
  // Split on sentence-ending punctuation followed by whitespace or end of string.
  // Keep the delimiter attached to the preceding sentence.
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Splits text into paragraphs on one or more blank lines.
 */
function splitIntoParagraphs(text: string): readonly string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Splits a string at word boundaries to fit within a token budget.
 * Returns an array of segments each approximating at most maxTokens tokens.
 */
function splitByTokenBudget(text: string, maxTokens: number): readonly string[] {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const segments: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const word of words) {
    const wordTokens = Math.ceil(word.length / 4); // rough char-based fallback per word
    if (currentTokens + wordTokens > maxTokens && current.length > 0) {
      segments.push(current.join(' '));
      current = [];
      currentTokens = 0;
    }
    current.push(word);
    currentTokens += wordTokens;
  }

  if (current.length > 0) {
    segments.push(current.join(' '));
  }

  return segments;
}

/**
 * Breaks text into a flat list of segments that each fit within maxTokens.
 * Strategy: paragraphs → sentences → word-boundary splits.
 */
function segmentText(text: string, maxTokens: number): readonly string[] {
  const segments: string[] = [];

  const paragraphs = splitIntoParagraphs(text);

  for (const paragraph of paragraphs) {
    const paraTokens = approximateTokenCount(paragraph);

    if (paraTokens <= maxTokens) {
      segments.push(paragraph);
      continue;
    }

    // Paragraph too large — split into sentences
    const sentences = splitIntoSentences(paragraph);
    let currentSentences: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = approximateTokenCount(sentence);

      if (sentenceTokens > maxTokens) {
        // Single sentence exceeds budget — split by word boundary
        if (currentSentences.length > 0) {
          segments.push(currentSentences.join(' '));
          currentSentences = [];
          currentTokens = 0;
        }
        const subSegments = splitByTokenBudget(sentence, maxTokens);
        segments.push(...subSegments);
        continue;
      }

      if (currentTokens + sentenceTokens > maxTokens && currentSentences.length > 0) {
        segments.push(currentSentences.join(' '));
        currentSentences = [];
        currentTokens = 0;
      }

      currentSentences.push(sentence);
      currentTokens += sentenceTokens;
    }

    if (currentSentences.length > 0) {
      segments.push(currentSentences.join(' '));
    }
  }

  return segments;
}

/**
 * Converts a list of segments into overlapping chunks.
 * Overlap is achieved by prepending words from the end of the previous chunk
 * to reach the configured overlap token count.
 */
function applyOverlap(
  segments: readonly string[],
  chunkSize: number,
  overlapTokens: number,
): readonly string[] {
  if (segments.length === 0) return [];

  const chunks: string[] = [];
  const firstSegment = segments[0];
  if (firstSegment !== undefined) {
    chunks.push(firstSegment);
  }

  for (let i = 1; i < segments.length; i++) {
    const prev = chunks[chunks.length - 1] ?? '';
    const prevWords = prev.trim().split(/\s+/).filter((w) => w.length > 0);

    // Collect enough trailing words from the previous chunk to fill overlapTokens
    let overlapWordCount = 0;
    let accumulatedTokens = 0;
    for (let j = prevWords.length - 1; j >= 0; j--) {
      const word = prevWords[j];
      if (word === undefined) break;
      const wordTokens = Math.ceil(word.length / 4);
      if (accumulatedTokens + wordTokens > overlapTokens) break;
      accumulatedTokens += wordTokens;
      overlapWordCount++;
    }

    const overlapWords = prevWords.slice(prevWords.length - overlapWordCount);
    const current = segments[i];
    if (current === undefined) continue;

    const chunkContent =
      overlapWords.length > 0 ? overlapWords.join(' ') + ' ' + current : current;

    // If appending overlap pushes us over chunkSize, trim from the end instead
    if (approximateTokenCount(chunkContent) > chunkSize * 1.5) {
      chunks.push(current);
    } else {
      chunks.push(chunkContent);
    }
  }

  return chunks;
}

/**
 * Splits `text` into overlapping TextChunks according to the provided config.
 *
 * Splitting hierarchy:
 *   1. Paragraphs (double newline)
 *   2. Sentences (punctuation boundaries)
 *   3. Word boundaries (token budget fallback)
 *
 * Token approximation: ~0.75 tokens per word.
 * Overlap is applied by prepending trailing words from the previous chunk.
 */
export function chunkText(
  text: string,
  config: Pick<AppConfig, 'chunkSize' | 'chunkOverlap'>,
): readonly TextChunk[] {
  const { chunkSize, chunkOverlap } = config;

  if (text.trim().length === 0) {
    return [];
  }

  const segments = segmentText(text, chunkSize);
  const overlapped = applyOverlap(segments, chunkSize, chunkOverlap);

  return overlapped.map((content, index) => ({
    content,
    index,
    tokenCount: approximateTokenCount(content),
    metadata: {},
  }));
}
