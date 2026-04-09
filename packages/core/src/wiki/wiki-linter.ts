/**
 * Wiki lint engine. Checks wiki pages for quality issues using both
 * structural analysis (broken links, orphans) and LLM-powered checks
 * (contradictions, completeness).
 */
import type { Result } from '@delve/shared';
import type { LlmProvider } from '../llm/provider.js';
import { WIKI_LINT_SYSTEM_PROMPT, buildWikiLintPrompt } from './wiki-prompts.js';
import { parseJsonResponse } from './wiki-generator.js';

export type WikiLintIssueType = 'contradiction' | 'missing_link' | 'stale' | 'incomplete' | 'orphaned' | 'broken_link';
export type WikiLintSeverity = 'low' | 'medium' | 'high';

export interface WikiLintIssue {
  readonly type: WikiLintIssueType;
  readonly severity: WikiLintSeverity;
  readonly description: string;
  readonly affectedPages: readonly string[];
  readonly suggestedFix: string;
}

export interface WikiLintResult {
  readonly issues: readonly WikiLintIssue[];
  readonly summary: string;
}

/** Pages with unresolved wiki-links (target_source_id IS NULL). */
export interface BrokenLink {
  readonly sourcePageTitle: string;
  readonly targetFilename: string;
}

/** Pages with zero incoming links. */
export interface OrphanedPage {
  readonly title: string;
  readonly sourceId: string;
}

/**
 * Run structural lint checks that don't require an LLM.
 * These are fast, deterministic checks.
 */
export function runStructuralLint(
  brokenLinks: readonly BrokenLink[],
  orphanedPages: readonly OrphanedPage[],
  stalePages: readonly { title: string; sourceId: string; reason: string }[],
): WikiLintIssue[] {
  const issues: WikiLintIssue[] = [];

  for (const link of brokenLinks) {
    issues.push({
      type: 'broken_link',
      severity: 'medium',
      description: `Page "${link.sourcePageTitle}" links to "${link.targetFilename}" which does not exist.`,
      affectedPages: [link.sourcePageTitle],
      suggestedFix: `Create a page titled "${link.targetFilename}" or remove the broken link.`,
    });
  }

  for (const page of orphanedPages) {
    issues.push({
      type: 'orphaned',
      severity: 'low',
      description: `Page "${page.title}" has no incoming links from other pages.`,
      affectedPages: [page.title],
      suggestedFix: `Add [[${page.title}]] links from related pages.`,
    });
  }

  for (const page of stalePages) {
    issues.push({
      type: 'stale',
      severity: 'medium',
      description: `Page "${page.title}" may be outdated: ${page.reason}`,
      affectedPages: [page.title],
      suggestedFix: `Re-generate the page from the updated source.`,
    });
  }

  return issues;
}

/**
 * Run LLM-powered semantic lint checks (contradictions, missing cross-refs).
 * Batches pages to stay within context limits.
 */
export async function runSemanticLint(
  llm: LlmProvider,
  pages: readonly { title: string; content: string }[],
  model?: string,
): Promise<Result<WikiLintIssue[], string>> {
  if (pages.length === 0) {
    return { ok: true, value: [] };
  }

  // Batch pages to avoid exceeding context. ~20 pages per batch.
  const BATCH_SIZE = 20;
  const allIssues: WikiLintIssue[] = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const prompt = buildWikiLintPrompt(batch);
    const result = await llm.query({
      prompt,
      systemPrompt: WIKI_LINT_SYSTEM_PROMPT,
      model,
      maxTokens: 4000,
    });

    if (!result.ok) {
      return { ok: false, error: `LLM lint query failed: ${result.error}` };
    }

    const parsed = parseJsonResponse<{
      issues?: { type: string; severity: string; description: string; affectedPages: string[]; suggestedFix: string }[];
    }>(result.value.content);

    if (parsed.ok) {
      for (const issue of parsed.value.issues ?? []) {
        allIssues.push({
          type: issue.type as WikiLintIssueType,
          severity: issue.severity as WikiLintSeverity,
          description: issue.description,
          affectedPages: issue.affectedPages,
          suggestedFix: issue.suggestedFix,
        });
      }
    }
    // If one batch fails to parse, continue with others
  }

  return { ok: true, value: allIssues };
}
