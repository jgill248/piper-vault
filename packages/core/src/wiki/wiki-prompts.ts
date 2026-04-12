/**
 * System and user prompt templates for LLM Wiki operations.
 *
 * Each operation (ingest, query-to-wiki, lint, index) has a dedicated prompt
 * that instructs the LLM to produce structured JSON output.
 */

/**
 * System prompt for wiki page generation during source ingestion.
 * The LLM analyzes a source document and produces wiki pages.
 */
export const WIKI_INGEST_SYSTEM_PROMPT = `You are a knowledge engineer that builds and maintains a personal wiki. Your job is to analyze source documents and produce structured wiki pages that capture the key entities, concepts, and claims found in the source.

Guidelines:
- Extract the most important entities, concepts, and claims from the source.
- For each, produce a wiki page with a clear title, structured markdown content, and relevant tags.
- Use [[wiki-links]] to connect related concepts. Link to both existing pages and new pages you are creating.
- Each page should be self-contained but reference related pages via wiki-links.
- Include a "Sources" section at the bottom of each page citing the original source.
- Write in an encyclopedic, neutral tone — factual and concise.
- Do not invent information beyond what the source contains.
- If the source updates or contradicts information in an existing wiki page, note the update in your response.

Respond with valid JSON only. No markdown fences, no explanation outside the JSON.`;

/**
 * Builds the user prompt for wiki ingest, including source content and existing pages.
 */
export function buildWikiIngestPrompt(
  sourceFilename: string,
  sourceContent: string,
  existingPageTitles: readonly string[],
  maxPages: number,
): string {
  const existingList =
    existingPageTitles.length > 0
      ? `\nExisting wiki pages (link to these where relevant):\n${existingPageTitles.map((t) => `- [[${t}]]`).join('\n')}`
      : '\nNo existing wiki pages yet.';

  return `Analyze the following source document and generate up to ${maxPages} wiki pages.
${existingList}

Source filename: ${sourceFilename}
---
${sourceContent}
---

Respond with a JSON object matching this schema:
{
  "pages": [
    {
      "title": "Page Title",
      "content": "Markdown content with [[wiki-links]]...",
      "tags": ["tag1", "tag2"]
    }
  ],
  "updatedPages": [
    {
      "title": "Existing Page Title",
      "appendContent": "New content to append or merge...",
      "reason": "Why this page needs updating"
    }
  ],
  "summary": "One-line summary of what was generated"
}`;
}

/**
 * System prompt for converting a chat conversation into a wiki page.
 */
export const WIKI_PROMOTE_SYSTEM_PROMPT = `You are a knowledge engineer. Your job is to convert a chat conversation into a well-structured wiki page. Extract the key insights, synthesize them into a coherent article, and add [[wiki-links]] to connect to related topics.

Guidelines:
- Produce a single, focused wiki page from the conversation.
- Use a clear, descriptive title that captures the topic.
- Structure with headings, bullet points, and paragraphs as appropriate.
- Include [[wiki-links]] to related concepts.
- Cite the original sources referenced in the conversation using [Source N] notation.
- Do not include conversational artifacts ("the user asked...", "I think...").
- Write in an encyclopedic, neutral tone.

Respond with valid JSON only. No markdown fences.`;

/**
 * Builds the user prompt for promoting a conversation to a wiki page.
 */
export function buildWikiPromotePrompt(
  conversationMessages: readonly { role: string; content: string }[],
  existingPageTitles: readonly string[],
): string {
  const transcript = conversationMessages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const existingList =
    existingPageTitles.length > 0
      ? `\nExisting wiki pages (link to these where relevant):\n${existingPageTitles.map((t) => `- [[${t}]]`).join('\n')}`
      : '';

  return `Convert this conversation into a wiki page:
${existingList}

---
${transcript}
---

Respond with a JSON object:
{
  "title": "Page Title",
  "content": "Markdown content with [[wiki-links]]...",
  "tags": ["tag1", "tag2"],
  "summary": "One-line summary of the page"
}`;
}

/**
 * System prompt for wiki lint operations.
 */
export const WIKI_LINT_SYSTEM_PROMPT = `You are a knowledge quality auditor. Your job is to review wiki pages for quality issues: contradictions between pages, stale or unsupported claims, missing cross-references, and content gaps.

Guidelines:
- Compare related pages for factual consistency.
- Flag claims that appear to contradict each other across pages.
- Identify pages that should link to each other but don't.
- Note any pages that seem incomplete or need expansion.
- Be specific about the issue and which pages are involved.

Respond with valid JSON only.`;

/**
 * Builds the user prompt for lint operations.
 */
export function buildWikiLintPrompt(
  pages: readonly { title: string; content: string }[],
): string {
  const pageList = pages
    .map((p) => `## ${p.title}\n${p.content}`)
    .join('\n\n---\n\n');

  return `Review these wiki pages for quality issues:

${pageList}

Respond with a JSON object:
{
  "issues": [
    {
      "type": "contradiction" | "missing_link" | "stale" | "incomplete" | "orphaned",
      "severity": "low" | "medium" | "high",
      "description": "Description of the issue",
      "affectedPages": ["Page Title 1", "Page Title 2"],
      "suggestedFix": "How to fix this issue"
    }
  ],
  "summary": "Overall assessment of wiki health"
}`;
}

/**
 * System prompt for synthesizing new source content into an existing wiki page.
 * The LLM rewrites the page to coherently merge old and new information.
 */
export const WIKI_SYNTHESIZE_SYSTEM_PROMPT = `You are a knowledge engineer maintaining a personal wiki. You are given an existing wiki page and new source material that is relevant to it. Your job is to produce a unified rewrite of the page that coherently incorporates the new information.

Guidelines:
- Produce a COMPLETE rewrite of the page — not an appendix or addendum.
- Preserve the existing structure, headings, and [[wiki-links]] where they are still accurate.
- Integrate new facts, claims, and details from the source material into the appropriate sections.
- If the new source contradicts existing content, prefer the newer information but note the discrepancy.
- Add new [[wiki-links]] where the new source introduces related concepts.
- Update the "Sources" section to include the new source alongside existing citations.
- Maintain an encyclopedic, neutral tone — factual and concise.
- Do not invent information beyond what the existing page and new source contain.
- If the new source adds nothing meaningful to the page, set changeType to "no_change" and return the existing content unchanged.

Respond with valid JSON only. No markdown fences, no explanation outside the JSON.`;

/**
 * Builds the user prompt for wiki page synthesis.
 */
export function buildWikiSynthesizePrompt(
  pageTitle: string,
  existingContent: string,
  existingTags: readonly string[],
  newSourceContent: string,
  newSourceFilename: string,
): string {
  const tagList = existingTags.length > 0 ? `Tags: ${existingTags.join(', ')}` : '';

  return `Rewrite the following wiki page to incorporate new source material.

Page title: ${pageTitle}
${tagList}

--- EXISTING PAGE CONTENT ---
${existingContent}
--- END EXISTING PAGE CONTENT ---

--- NEW SOURCE MATERIAL ---
Source filename: ${newSourceFilename}
${newSourceContent}
--- END NEW SOURCE MATERIAL ---

Respond with a JSON object matching this schema:
{
  "content": "Full rewritten markdown content with [[wiki-links]]...",
  "summary": "One-line summary of what changed",
  "changeType": "minor_update" | "major_rewrite" | "no_change"
}`;
}

/**
 * System prompt for generating the wiki index.
 */
export const WIKI_INDEX_SYSTEM_PROMPT = `You are a librarian organizing a wiki index. Given a list of wiki pages with their titles, tags, and summaries, produce a structured index organized by category.

Respond with valid JSON only.`;

/**
 * Builds the user prompt for index generation.
 */
export function buildWikiIndexPrompt(
  pages: readonly { title: string; tags: readonly string[]; summary: string }[],
): string {
  const pageList = pages
    .map((p) => `- ${p.title} [${p.tags.join(', ')}]: ${p.summary}`)
    .join('\n');

  return `Organize these wiki pages into a structured index:

${pageList}

Respond with a JSON object:
{
  "categories": [
    {
      "name": "Category Name",
      "pages": [
        { "title": "Page Title", "summary": "One-line summary" }
      ]
    }
  ]
}`;
}
