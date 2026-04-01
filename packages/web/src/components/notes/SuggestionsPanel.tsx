import { Link, Sparkles } from 'lucide-react';
import { useSuggestions } from '../../hooks/use-notes';

interface SuggestionsPanelProps {
  readonly noteId: string;
  readonly onNavigateToNote: (id: string) => void;
  readonly onInsertLink: (filename: string) => void;
}

export function SuggestionsPanel({ noteId, onNavigateToNote, onInsertLink }: SuggestionsPanelProps) {
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

  return (
    <div className="border-t border-outline-variant/20">
      <div className="px-3 py-2 flex items-center gap-1.5">
        <Sparkles size={10} strokeWidth={1.5} className="text-tertiary" />
        <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
          Suggested Links ({suggestions.length})
        </span>
      </div>
      <div className="flex flex-col">
        {suggestions.map((entry) => (
          <div
            key={entry.sourceId}
            className="flex items-center gap-1 px-3 py-1.5 hover:bg-surface transition-colors"
          >
            <button
              onClick={() => onNavigateToNote(entry.sourceId)}
              className="flex-1 text-left text-xs font-label text-secondary hover:text-primary truncate"
              title={entry.title || entry.filename}
            >
              {entry.title || entry.filename}
            </button>
            <span className="text-[9px] font-label text-on-surface-variant shrink-0">
              {Math.round(entry.score * 100)}%
            </span>
            <button
              onClick={() => onInsertLink(entry.title || entry.filename.replace(/\.md$/, ''))}
              className="p-1 text-on-surface-variant hover:text-primary transition-colors shrink-0"
              title="Insert wiki-link"
              aria-label={`Insert link to ${entry.title || entry.filename}`}
            >
              <Link size={10} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
