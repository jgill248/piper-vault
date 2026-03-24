export const WIKI_LINK_TYPES = ['wiki-link', 'embed', 'heading-ref'] as const;
export type WikiLinkType = (typeof WIKI_LINK_TYPES)[number];

export interface ParsedWikiLink {
  readonly targetFilename: string;
  readonly displayText: string | null;
  readonly section: string | null;
  readonly linkType: WikiLinkType;
  readonly position: { readonly start: number; readonly end: number };
}

/**
 * Parses wiki-link patterns from markdown text.
 *
 * Supported patterns:
 * - `[[Page]]` — basic wiki-link
 * - `[[Page|Alias]]` — wiki-link with display text
 * - `[[Page#Section]]` — link to heading section
 * - `[[Page#Section|Alias]]` — section link with display text
 * - `![[Page]]` — embed (transclusion)
 *
 * Links inside fenced code blocks and inline code are excluded.
 */
export function parseWikiLinks(text: string): readonly ParsedWikiLink[] {
  // Build a set of ranges to exclude (code blocks and inline code)
  const excludedRanges = getExcludedRanges(text);

  const results: ParsedWikiLink[] = [];

  // Match both embeds ![[...]] and regular links [[...]]
  // The inner content must not contain [ or ] to avoid matching nested brackets
  const pattern = /(!)?\[\[([^[\]]+?)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Skip if inside a code block or inline code
    if (isInExcludedRange(start, excludedRanges)) {
      continue;
    }

    const isEmbed = match[1] === '!';
    const inner = match[2]!;

    // Parse the inner content: Page#Section|Alias
    const { targetFilename, section, displayText, linkType } = parseInner(
      inner,
      isEmbed,
    );

    results.push({
      targetFilename,
      displayText,
      section,
      linkType,
      position: { start, end },
    });
  }

  return results;
}

interface ParsedInner {
  targetFilename: string;
  section: string | null;
  displayText: string | null;
  linkType: WikiLinkType;
}

function parseInner(inner: string, isEmbed: boolean): ParsedInner {
  // Split on pipe first: [[target|display]]
  const pipeIdx = inner.indexOf('|');
  let target: string;
  let displayText: string | null = null;

  if (pipeIdx !== -1) {
    target = inner.slice(0, pipeIdx).trim();
    displayText = inner.slice(pipeIdx + 1).trim() || null;
  } else {
    target = inner.trim();
  }

  // Split target on hash: Page#Section
  let targetFilename: string;
  let section: string | null = null;
  const hashIdx = target.indexOf('#');

  if (hashIdx !== -1) {
    targetFilename = target.slice(0, hashIdx).trim();
    section = target.slice(hashIdx + 1).trim() || null;
  } else {
    targetFilename = target;
  }

  let linkType: WikiLinkType;
  if (isEmbed) {
    linkType = 'embed';
  } else if (section !== null) {
    linkType = 'heading-ref';
  } else {
    linkType = 'wiki-link';
  }

  return { targetFilename, section, displayText, linkType };
}

interface Range {
  start: number;
  end: number;
}

/**
 * Returns ranges of text that should be excluded from wiki-link parsing
 * (fenced code blocks and inline code spans).
 */
function getExcludedRanges(text: string): readonly Range[] {
  const ranges: Range[] = [];

  // Fenced code blocks: ```...```
  const fencedPattern = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = fencedPattern.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }

  // Inline code: `...`
  const inlinePattern = /`[^`]+`/g;
  while ((m = inlinePattern.exec(text)) !== null) {
    // Only add if not already inside a fenced block
    if (!isInExcludedRange(m.index, ranges)) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  return ranges;
}

function isInExcludedRange(pos: number, ranges: readonly Range[]): boolean {
  for (const range of ranges) {
    if (pos >= range.start && pos < range.end) {
      return true;
    }
  }
  return false;
}
