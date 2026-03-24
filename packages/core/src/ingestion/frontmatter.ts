import { parse as parseYaml } from 'yaml';

export interface FrontmatterResult {
  /** Parsed frontmatter key-value pairs. Empty object if no frontmatter found. */
  readonly frontmatter: Record<string, unknown>;
  /** Markdown body with frontmatter block stripped. */
  readonly body: string;
  /** Tags extracted from frontmatter `tags` field and inline `#tag` patterns. */
  readonly tags: readonly string[];
  /** Title extracted from frontmatter `title` field, or null. */
  readonly title: string | null;
}

/**
 * Extracts YAML frontmatter from a markdown string.
 *
 * Frontmatter must appear at the very start of the document, delimited by
 * `---` on its own line. If no valid frontmatter block is found, returns
 * an empty frontmatter object and the full text as body.
 *
 * Also extracts inline `#tag` patterns from the body text and merges them
 * with any tags declared in the frontmatter.
 */
export function extractFrontmatter(text: string): FrontmatterResult {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)---(?:\r?\n|$)/;
  const match = frontmatterRegex.exec(text);

  let frontmatter: Record<string, unknown> = {};
  let body: string;

  if (match) {
    body = text.slice(match[0].length);
    try {
      const parsed: unknown = parseYaml(match[1]!);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed YAML — treat as no frontmatter, return full text as body
      body = text;
      frontmatter = {};
    }
  } else {
    body = text;
  }

  // Extract tags from frontmatter
  const fmTags = extractFrontmatterTags(frontmatter);

  // Extract inline #tags from body (not inside code blocks or inline code)
  const inlineTags = extractInlineTags(body);

  // Merge and deduplicate tags
  const allTags = [...new Set([...fmTags, ...inlineTags])];

  // Extract title from frontmatter
  const title =
    typeof frontmatter['title'] === 'string' ? frontmatter['title'] : null;

  return { frontmatter, body, tags: allTags, title };
}

/**
 * Extracts tags from frontmatter `tags` field.
 * Handles both array format (`tags: [a, b]`) and string format (`tags: a, b`).
 */
function extractFrontmatterTags(fm: Record<string, unknown>): string[] {
  const raw = fm['tags'];
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.replace(/^#/, '').trim())
      .filter((t) => t.length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter((t) => t.length > 0);
  }

  return [];
}

/**
 * Extracts inline `#tag` patterns from markdown body text.
 * Skips tags inside fenced code blocks and inline code spans.
 */
function extractInlineTags(body: string): string[] {
  // Remove fenced code blocks
  const withoutCodeBlocks = body.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');

  const tagPattern = /(?:^|\s)#([a-zA-Z][\w/-]*)/g;
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(withoutInlineCode)) !== null) {
    const tag = m[1]!.trim();
    if (tag.length > 0) {
      tags.push(tag);
    }
  }

  return tags;
}
