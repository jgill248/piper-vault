import { Link, Sparkles } from 'lucide-react';
import { useSuggestions } from '../../hooks/use-notes';
import type { Source } from '@delve/shared';

interface SuggestionsPanelProps {
  readonly noteId: string;
  readonly onNavigateToNote: (id: string) => void;
  readonly onInsertLink: (filename: string) => void;
  /**
   * Optional: full list of known notes used to detect title collisions
   * (Bug 5 — wiki disambiguation). When provided, suggestions whose title
   * collides with another note get a folder-path disambiguator.
   */
  readonly knownNotes?: readonly Source[];
}

/**
 * Returns true if the note is a wiki-generated entry.
 */
function isWikiSource(note: Source): boolean {
  return note.isGenerated || (note.parentPath ?? '').startsWith('wiki/') || note.parentPath === 'wiki';
}

/**
 * Build a set of normalised titles that appear more than once across all
 * known notes so we know which suggestions need disambiguation.
 */
function buildDuplicateTitleSet(notes: readonly Source[]): Set<string> {
  const seen = new Map<string, number>();
  for (const note of notes) {
    const key = (note.title || note.filename).toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, count] of seen) {
    if (count > 1) dupes.add(key);
  }
  return dupes;
}

export function SuggestionsPanel({ noteId, onNavigateToNote, onInsertLink, knownNotes }: SuggestionsPanelProps) {
  const { data: suggestions, isLoading } = useSuggestions(noteId);

  if (isLoading) {
    return (
      <div className="p-3 text-xs font-label text-on-surface-variant">Finding connections...</div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="p-3 text-xs font-label text-on-surface-variant">No suggestions found.</div>
    );
  }

  // Bug 5: Build a lookup map from sourceId → full note so we can check isGenerated / parentPath.
  const knownNoteById = new Map<string, Source>();
  if (knownNotes) {
    for (const n of knownNotes) {
      knownNoteById.set(n.id, n);
    }
  }

  const duplicateTitles = knownNotes ? buildDuplicateTitleSet(knownNotes) : new Set<string>();

  return (
    <div className="border-t border-outline-variant/20">
      <div className="px-3 py-2 flex items-center gap-1.5">
        <Sparkles size={10} strokeWidth={1.5} className="text-tertiary" />
        <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
          Suggested Links ({suggestions.length})
        </span>
      </div>
      <div className="flex flex-col">
        {suggestions.map((entry) => {
          const displayTitle = entry.title || entry.filename;
          const titleKey = displayTitle.toLowerCase();
          const hasDuplicate = duplicateTitles.has(titleKey);
          const fullNote = knownNoteById.get(entry.sourceId);
          const wikiEntry = fullNote ? isWikiSource(fullNote) : false;

          return (
            <div
              key={entry.sourceId}
              className="flex items-start gap-1 px-3 py-1.5 hover:bg-surface transition-colors"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    onClick={() => onNavigateToNote(entry.sourceId)}
                    className="flex-1 text-left text-xs font-label text-secondary hover:text-primary truncate"
                    title={displayTitle}
                  >
                    {displayTitle}
                  </button>

                  {/* Bug 5: wiki badge */}
                  {wikiEntry && (
                    <span
                      className="shrink-0 text-[9px] font-mono uppercase tracking-wider px-1 bg-surface-container-high text-on-surface-variant border border-outline-variant/30"
                      title="Wiki-generated note"
                    >
                      wiki
                    </span>
                  )}
                </div>

                {/* Bug 5: folder-path disambiguator when title collides */}
                {hasDuplicate && fullNote?.parentPath && (
                  <span className="text-[9px] font-mono text-on-surface-variant truncate">
                    {fullNote.parentPath}/
                  </span>
                )}
              </div>

              <span className="text-[9px] font-label text-on-surface-variant shrink-0 self-center">
                {Math.round(entry.score * 100)}%
              </span>
              <button
                onClick={() => onInsertLink(entry.title || entry.filename.replace(/\.md$/, ''))}
                className="p-1 text-on-surface-variant hover:text-primary transition-colors shrink-0 self-center"
                title="Insert wiki-link"
                aria-label={`Insert link to ${displayTitle}`}
              >
                <Link size={10} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
