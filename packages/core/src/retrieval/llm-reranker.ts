import { ok } from '@delve/shared';
import type { Result, ChunkSearchResult } from '@delve/shared';
import type { LlmProvider } from '../llm/provider.js';
import type { Reranker } from './reranker.js';

export class LlmReranker implements Reranker {
  constructor(private readonly llm: LlmProvider) {}

  async rerank(
    query: string,
    candidates: readonly ChunkSearchResult[],
    topN: number,
  ): Promise<Result<ChunkSearchResult[], string>> {
    if (candidates.length <= topN) {
      return ok([...candidates]);
    }

    // Build a prompt that asks the LLM to score each chunk's relevance
    const chunkDescriptions = candidates
      .map(
        (c, i) =>
          `[${i}] (source: ${c.source.filename})\n${c.chunk.content.slice(0, 300)}`,
      )
      .join('\n\n');

    const prompt = `You are a relevance scoring system. Given a query and a list of text chunks, rate each chunk's relevance to the query on a scale of 0-10.

Query: "${query}"

Chunks:
${chunkDescriptions}

Respond with ONLY a JSON array of objects with "index" (number) and "score" (number 0-10). Example: [{"index": 0, "score": 8}, {"index": 1, "score": 3}]`;

    const result = await this.llm.query({
      prompt,
      systemPrompt:
        'You are a precise relevance scoring system. Output only valid JSON.',
      maxTokens: 1000,
    });

    if (!result.ok) {
      // On failure, return candidates unchanged (graceful degradation)
      return ok([...candidates].slice(0, topN));
    }

    try {
      // Parse the scores from LLM response
      const content = result.value.content.trim();
      // Extract JSON array from response (may be wrapped in markdown code block)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return ok([...candidates].slice(0, topN));
      }

      const scores = JSON.parse(jsonMatch[0]) as {
        index: number;
        score: number;
      }[];

      // Create scored candidates, falling back to original score for missing indices
      const scored = candidates.map((c, i) => {
        const llmScore = scores.find((s) => s.index === i);
        return { candidate: c, rerankScore: llmScore?.score ?? 0 };
      });

      // Sort by rerank score descending and take topN
      scored.sort((a, b) => b.rerankScore - a.rerankScore);
      return ok(scored.slice(0, topN).map((s) => s.candidate));
    } catch {
      // JSON parse failure — return original order
      return ok([...candidates].slice(0, topN));
    }
  }
}
