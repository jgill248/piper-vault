/**
 * Wiki index generator. Produces a structured catalog of all wiki pages,
 * organized by category. Replaces Karpathy's `index.md` with a structured
 * approach backed by the LLM.
 */
import type { Result } from '@delve/shared';
import type { LlmProvider } from '../llm/provider.js';
import { WIKI_INDEX_SYSTEM_PROMPT, buildWikiIndexPrompt } from './wiki-prompts.js';
import { parseJsonResponse } from './wiki-generator.js';

export interface WikiIndexPage {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export interface WikiIndexCategory {
  readonly name: string;
  readonly pages: readonly WikiIndexPage[];
}

export interface WikiIndex {
  readonly categories: readonly WikiIndexCategory[];
}

/** Raw index shape returned by the LLM (no page IDs). */
export interface RawWikiIndex {
  readonly categories: readonly {
    readonly name: string;
    readonly pages: readonly { title: string; summary: string }[];
  }[];
}

/**
 * Generate a structured wiki index from page metadata.
 */
export async function generateWikiIndex(
  llm: LlmProvider,
  pages: readonly { title: string; tags: readonly string[]; summary: string }[],
  model?: string,
): Promise<Result<RawWikiIndex, string>> {
  if (pages.length === 0) {
    return { ok: true, value: { categories: [] } };
  }

  const prompt = buildWikiIndexPrompt(pages);
  const result = await llm.query({
    prompt,
    systemPrompt: WIKI_INDEX_SYSTEM_PROMPT,
    model,
    maxTokens: 4000,
  });

  if (!result.ok) {
    return { ok: false, error: `LLM index query failed: ${result.error}` };
  }

  return parseJsonResponse<RawWikiIndex>(result.value.content);
}
