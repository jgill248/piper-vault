/**
 * Wiki index generator. Produces a structured catalog of all wiki pages,
 * organized by category. Replaces Karpathy's `index.md` with a structured
 * approach backed by the LLM.
 */
import type { Result } from '@delve/shared';
import type { LlmProvider } from '../llm/provider.js';
import { WIKI_INDEX_SYSTEM_PROMPT, buildWikiIndexPrompt } from './wiki-prompts.js';

export interface WikiIndexCategory {
  readonly name: string;
  readonly pages: readonly { title: string; summary: string }[];
}

export interface WikiIndex {
  readonly categories: readonly WikiIndexCategory[];
}

/**
 * Generate a structured wiki index from page metadata.
 */
export async function generateWikiIndex(
  llm: LlmProvider,
  pages: readonly { title: string; tags: readonly string[]; summary: string }[],
  model?: string,
): Promise<Result<WikiIndex, string>> {
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

  let cleaned = result.value.content.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    const lastFence = cleaned.lastIndexOf('```');
    if (firstNewline !== -1 && lastFence > firstNewline) {
      cleaned = cleaned.slice(firstNewline + 1, lastFence).trim();
    }
  }

  try {
    const parsed = JSON.parse(cleaned) as WikiIndex;
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: `Failed to parse wiki index JSON: ${cleaned.slice(0, 200)}` };
  }
}
