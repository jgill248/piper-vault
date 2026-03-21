import type { ConversationWithMessages } from '@delve/shared';

/**
 * Formats a conversation as a markdown document.
 */
export function exportConversationAsMarkdown(conversation: ConversationWithMessages): string {
  const lines: string[] = [];

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
      lines.push(`> Sources: ${msg.sources.join(', ')}`);
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
