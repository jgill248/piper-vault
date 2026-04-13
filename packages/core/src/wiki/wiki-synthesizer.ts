/**
 * Wiki page synthesis engine. Merges new source material into existing
 * wiki pages via LLM rewrite — replaces the old append-only model with
 * coherent, full-page synthesis.
 */
import type { Result } from '@delve/shared';
import type { LlmProvider } from '../llm/provider.js';
import { parseJsonResponse, sanitizeLlmText } from './wiki-generator.js';
import {
  WIKI_SYNTHESIZE_SYSTEM_PROMPT,
  buildWikiSynthesizePrompt,
} from './wiki-prompts.js';

export type WikiSynthesisChangeType = 'minor_update' | 'major_rewrite' | 'no_change';

/** Result of synthesizing new source content into an existing wiki page. */
export interface WikiSynthesisResult {
  /** Full rewritten page content (not appended — complete replacement). */
  readonly content: string;
  /** Union of all source IDs that contributed to this page. */
  readonly mergedSourceIds: readonly string[];
  /** One-line summary of what changed. */
  readonly summary: string;
  /** Classification of the change magnitude. */
  readonly changeType: WikiSynthesisChangeType;
}

/**
 * Synthesize new source content into an existing wiki page.
 *
 * Calls the LLM to produce a coherent rewrite that merges the existing page
 * content with relevant new source material. Returns the full rewritten page,
 * not an append.
 */
export async function synthesizeWikiPage(
  llm: LlmProvider,
  existingContent: string,
  existingSourceIds: readonly string[],
  newSourceContent: string,
  newSourceId: string,
  metadata: { pageTitle: string; pageTags: readonly string[] },
  model?: string,
): Promise<Result<WikiSynthesisResult, string>> {
  const prompt = buildWikiSynthesizePrompt(
    metadata.pageTitle,
    existingContent,
    metadata.pageTags,
    newSourceContent,
    newSourceId, // used as source filename in the prompt
  );

  const result = await llm.query({
    prompt,
    systemPrompt: WIKI_SYNTHESIZE_SYSTEM_PROMPT,
    model,
    maxTokens: 8000,
  });

  if (!result.ok) {
    return { ok: false, error: `LLM query failed: ${result.error}` };
  }

  const parsed = parseJsonResponse<{
    content?: string;
    summary?: string;
    changeType?: string;
  }>(result.value.content);

  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const data = parsed.value;
  const changeType = validateChangeType(data.changeType);

  // Deduplicate source IDs
  const mergedSourceIds = [...new Set([...existingSourceIds, newSourceId])];

  return {
    ok: true,
    value: {
      content: changeType === 'no_change'
        ? existingContent
        : sanitizeLlmText(data.content ?? existingContent),
      mergedSourceIds,
      summary: data.summary ?? `Synthesized ${metadata.pageTitle} with new source`,
      changeType,
    },
  };
}

function validateChangeType(raw: string | undefined): WikiSynthesisChangeType {
  if (raw === 'minor_update' || raw === 'major_rewrite' || raw === 'no_change') {
    return raw;
  }
  return 'minor_update';
}
