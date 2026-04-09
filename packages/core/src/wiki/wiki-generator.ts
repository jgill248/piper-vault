/**
 * Core wiki generation engine. Framework-agnostic — consumes an LlmProvider
 * and produces structured wiki page drafts.
 */
import type { Result } from '@delve/shared';
import type { LlmProvider } from '../llm/provider.js';
import {
  WIKI_INGEST_SYSTEM_PROMPT,
  buildWikiIngestPrompt,
  WIKI_PROMOTE_SYSTEM_PROMPT,
  buildWikiPromotePrompt,
} from './wiki-prompts.js';

/** A draft for a brand-new wiki page. */
export interface WikiPageDraft {
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
}

/** An update to an existing wiki page. */
export interface WikiPageUpdate {
  readonly title: string;
  readonly appendContent: string;
  readonly reason: string;
}

/** Result of a wiki generation pass. */
export interface WikiGenerationResult {
  readonly pages: readonly WikiPageDraft[];
  readonly updatedPages: readonly WikiPageUpdate[];
  readonly summary: string;
}

/** Result of promoting a conversation to a wiki page. */
export interface WikiPromoteResult {
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly summary: string;
}

/**
 * Parses a JSON response from the LLM, stripping markdown code fences if present.
 */
export function parseJsonResponse<T>(raw: string): Result<T, string> {
  let cleaned = raw.trim();
  // Strip ```json ... ``` fences
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    const lastFence = cleaned.lastIndexOf('```');
    if (firstNewline !== -1 && lastFence > firstNewline) {
      cleaned = cleaned.slice(firstNewline + 1, lastFence).trim();
    }
  }
  try {
    return { ok: true, value: JSON.parse(cleaned) as T };
  } catch {
    return { ok: false, error: `Failed to parse LLM JSON response: ${cleaned.slice(0, 200)}` };
  }
}

/**
 * Generate wiki pages from a source document.
 */
export async function generateWikiPages(
  llm: LlmProvider,
  sourceFilename: string,
  sourceContent: string,
  existingPageTitles: readonly string[],
  maxPages: number,
  model?: string,
): Promise<Result<WikiGenerationResult, string>> {
  const prompt = buildWikiIngestPrompt(sourceFilename, sourceContent, existingPageTitles, maxPages);
  const result = await llm.query({
    prompt,
    systemPrompt: WIKI_INGEST_SYSTEM_PROMPT,
    model,
    maxTokens: 8000,
  });

  if (!result.ok) {
    return { ok: false, error: `LLM query failed: ${result.error}` };
  }

  const parsed = parseJsonResponse<{
    pages?: { title: string; content: string; tags?: string[] }[];
    updatedPages?: { title: string; appendContent: string; reason: string }[];
    summary?: string;
  }>(result.value.content);

  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const data = parsed.value;
  return {
    ok: true,
    value: {
      pages: (data.pages ?? []).map((p) => ({
        title: p.title,
        content: p.content,
        tags: p.tags ?? [],
      })),
      updatedPages: (data.updatedPages ?? []).map((u) => ({
        title: u.title,
        appendContent: u.appendContent,
        reason: u.reason,
      })),
      summary: data.summary ?? `Generated ${data.pages?.length ?? 0} pages from ${sourceFilename}`,
    },
  };
}

/**
 * Promote a chat conversation into a wiki page.
 */
export async function promoteConversationToWiki(
  llm: LlmProvider,
  messages: readonly { role: string; content: string }[],
  existingPageTitles: readonly string[],
  model?: string,
): Promise<Result<WikiPromoteResult, string>> {
  const prompt = buildWikiPromotePrompt(messages, existingPageTitles);
  const result = await llm.query({
    prompt,
    systemPrompt: WIKI_PROMOTE_SYSTEM_PROMPT,
    model,
    maxTokens: 4000,
  });

  if (!result.ok) {
    return { ok: false, error: `LLM query failed: ${result.error}` };
  }

  const parsed = parseJsonResponse<{
    title: string;
    content: string;
    tags?: string[];
    summary?: string;
  }>(result.value.content);

  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const data = parsed.value;
  return {
    ok: true,
    value: {
      title: data.title,
      content: data.content,
      tags: data.tags ?? [],
      summary: data.summary ?? `Promoted conversation to wiki page: ${data.title}`,
    },
  };
}
