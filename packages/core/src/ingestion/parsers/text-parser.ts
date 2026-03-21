import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { FileParser, ParsedContent } from '../parser.js';

/**
 * Extracts headings from markdown text.
 * Returns an array of heading strings found in the document.
 */
function extractHeadings(text: string): readonly string[] {
  const headingPattern = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(text)) !== null) {
    const heading = match[1];
    if (heading !== undefined) {
      headings.push(heading.trim());
    }
  }
  return headings;
}

/**
 * Strips markdown syntax from text to produce plain text.
 * Preserves word content while removing formatting markers.
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove fenced code blocks (preserve content)
      .replace(/```[\s\S]*?```/g, (match) => {
        // Extract just the code content between fences
        const lines = match.split('\n');
        // Remove first and last fence lines
        return lines.slice(1, lines.length - 1).join('\n');
      })
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove headings markers (keep text)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      // Remove links — keep display text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove reference-style links
      .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // Remove link reference definitions
      .replace(/^\[[^\]]+\]:\s*.+$/gm, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove blockquote markers
      .replace(/^>\s?/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove unordered list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      // Remove ordered list markers
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // Collapse multiple blank lines into two
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export class TextParser implements FileParser {
  readonly supportedTypes: readonly string[] = ['text/plain', 'text/markdown'];

  async parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>> {
    try {
      const raw = buffer.toString('utf-8');
      const isMarkdown =
        filename.endsWith('.md') || filename.endsWith('.markdown');
      const mimeFromFilename = isMarkdown ? 'text/markdown' : 'text/plain';

      const metadata: Record<string, unknown> = {
        filename,
        mimeType: mimeFromFilename,
        characterCount: raw.length,
      };

      if (isMarkdown) {
        const headings = extractHeadings(raw);
        if (headings.length > 0) {
          metadata['headings'] = headings;
          // Use the first heading as the title if present
          metadata['title'] = headings[0];
        }
        const stripped = stripMarkdown(raw);
        return ok({ text: stripped, metadata });
      }

      return ok({ text: raw, metadata });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`TextParser failed to parse "${filename}": ${message}`);
    }
  }
}
