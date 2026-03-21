import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { FileParser, ParsedContent } from '../parser.js';

/**
 * Normalises whitespace: collapses runs of spaces/tabs, trims each line,
 * and removes excessive blank lines.
 */
function normaliseWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, arr) => {
      // Allow at most one consecutive blank line
      if (line.length === 0) {
        return index === 0 || arr[index - 1]?.length !== 0;
      }
      return true;
    })
    .join('\n')
    .trim();
}

export class HtmlParser implements FileParser {
  readonly supportedTypes: readonly string[] = ['text/html'];

  async parse(buffer: Buffer, filename: string): Promise<Result<ParsedContent, string>> {
    try {
      const cheerio = await import('cheerio');
      const load = cheerio.load;

      const html = buffer.toString('utf-8');

      if (html.trim().length === 0) {
        return err(`HtmlParser: "${filename}" is empty`);
      }

      const $ = load(html);

      // Remove elements that should not contribute to content
      $('script, style, nav, footer, header, noscript, iframe, svg').remove();

      // Collect headings for metadata
      const headings: string[] = [];
      $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
        const text = $(el).text().trim();
        if (text.length > 0) {
          const tag = (el as { tagName?: string }).tagName ?? 'h1';
          headings.push(`${tag.toUpperCase()}: ${text}`);
        }
      });

      // Extract text from semantic content elements
      const contentSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, code';
      const textParts: string[] = [];

      $(contentSelectors).each((_i, el) => {
        const text = $(el).text().trim();
        if (text.length > 0) {
          textParts.push(text);
        }
      });

      // If the selective extraction produced nothing, fall back to body text
      let text: string;
      if (textParts.length > 0) {
        text = normaliseWhitespace(textParts.join('\n'));
      } else {
        text = normaliseWhitespace($('body').text());
      }

      if (text.trim().length === 0) {
        return err(`HtmlParser: "${filename}" contains no readable text content`);
      }

      const metadata: Record<string, unknown> = {
        filename,
        mimeType: 'text/html',
        characterCount: text.length,
        title: $('title').text().trim() || undefined,
        headings,
      };

      // Remove undefined title to keep metadata clean
      if (metadata['title'] === undefined) {
        delete metadata['title'];
      }

      return ok({ text, metadata });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(`HtmlParser failed to parse "${filename}": ${message}`);
    }
  }
}
