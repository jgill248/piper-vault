import type { ConversationWithMessages } from '@delve/shared';

export interface WikiLinkExportOptions {
  /** Map of source ID → filename for resolving citations to wiki-links */
  readonly sourceIdToFilename?: ReadonlyMap<string, string>;
}

/**
 * Formats a conversation as a markdown document.
 */
export function exportConversationAsMarkdown(
  conversation: ConversationWithMessages,
  options?: WikiLinkExportOptions,
): string {
  const useWikiLinks = options?.sourceIdToFilename !== undefined;
  const lines: string[] = [];

  // YAML frontmatter for wiki-link format
  if (useWikiLinks) {
    lines.push('---');
    lines.push('tags: [delve/conversation]');
    lines.push(`date: ${new Date().toISOString().split('T')[0]}`);
    lines.push(`title: "${conversation.title.replace(/"/g, '\\"')}"`);
    lines.push('---');
    lines.push('');
  }

  lines.push(`# ${conversation.title}`);
  lines.push('');
  lines.push(`*Exported on ${new Date().toISOString().split('T')[0]}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of conversation.messages) {
    const role =
      msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    const timestamp =
      msg.createdAt instanceof Date
        ? msg.createdAt.toISOString()
        : new Date(msg.createdAt).toISOString();

    lines.push(`## ${role}`);
    lines.push(`*${timestamp}*`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');

    if (msg.sources && msg.sources.length > 0) {
      if (useWikiLinks && options?.sourceIdToFilename) {
        const wikiLinks = msg.sources.map((sourceId) => {
          const filename = options.sourceIdToFilename!.get(sourceId);
          if (filename) {
            const name = filename.replace(/\.md$/, '');
            return `[[${name}]]`;
          }
          return sourceId;
        });
        lines.push(`> Sources: ${wikiLinks.join(', ')}`);
      } else {
        lines.push(`> Sources: ${msg.sources.join(', ')}`);
      }
      lines.push('');
    }

    if (msg.model) {
      lines.push(`> Model: ${msg.model}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
