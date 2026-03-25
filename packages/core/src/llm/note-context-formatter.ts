/**
 * Formats note metadata into a context block that the LLM can use to
 * list, summarise, or answer questions about notes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteMetadata {
  readonly id: string;
  readonly title: string | null;
  readonly filename: string;
  readonly tags: readonly string[];
  readonly content: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly parentPath: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT_PREVIEW_LENGTH = 200;
const MAX_NOTES_IN_CONTEXT = 50;

function formatDate(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function contentPreview(content: string | null): string {
  if (!content || content.trim().length === 0) return '(empty note)';
  const trimmed = content.trim();
  if (trimmed.length <= CONTENT_PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, CONTENT_PREVIEW_LENGTH).trimEnd()}...`;
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

/**
 * Format an array of note metadata into a context block for the LLM prompt.
 *
 * @param notes     The notes matching the query criteria.
 * @param dateLabel A human-readable label for the time range (e.g. "today",
 *                  "yesterday", "this week").
 */
export function formatNoteContext(
  notes: readonly NoteMetadata[],
  dateLabel: string,
): string {
  if (notes.length === 0) {
    return `--- Notes from ${dateLabel} ---\nNo notes were found for ${dateLabel}.\n--- End of Notes ---`;
  }

  const displayed = notes.slice(0, MAX_NOTES_IN_CONTEXT);
  const truncated = notes.length > MAX_NOTES_IN_CONTEXT;

  const lines: string[] = [
    `--- Notes from ${dateLabel} ---`,
    `Found ${notes.length} note${notes.length === 1 ? '' : 's'} from ${dateLabel}.`,
    '',
  ];

  for (let i = 0; i < displayed.length; i++) {
    const note = displayed[i]!;
    const num = i + 1;
    const title = note.title ?? note.filename;
    const created = formatDate(note.createdAt);
    const tags =
      note.tags.length > 0 ? `Tags: ${note.tags.map((t: string) => `#${t}`).join(', ')}` : '';
    const folder = note.parentPath ? `Folder: ${note.parentPath}` : '';
    const preview = contentPreview(note.content);

    lines.push(`${num}. "${title}" (created ${created})`);
    if (folder) lines.push(`   ${folder}`);
    if (tags) lines.push(`   ${tags}`);
    lines.push(`   ${preview}`);
    lines.push('');
  }

  if (truncated) {
    lines.push(
      `Showing ${MAX_NOTES_IN_CONTEXT} of ${notes.length} notes. Ask a more specific question to narrow results.`,
    );
    lines.push('');
  }

  lines.push('--- End of Notes ---');
  return lines.join('\n');
}
