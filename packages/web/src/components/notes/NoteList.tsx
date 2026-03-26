import { FileText, Trash2 } from 'lucide-react';
import type { Source } from '@delve/shared';

interface NoteListProps {
  readonly notes: readonly Source[];
  readonly selectedNoteId: string | undefined;
  readonly onSelectNote: (id: string) => void;
  readonly onDeleteNote: (id: string) => void;
  readonly isLoading: boolean;
}

export function NoteList({
  notes,
  selectedNoteId,
  onSelectNote,
  onDeleteNote,
  isLoading,
}: NoteListProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-xs font-mono text-ui-dim uppercase tracking-wider animate-pulse">
        Loading notes...
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="p-4 text-xs font-mono text-ui-dim text-center uppercase tracking-wider">
        No notes yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {notes.map((note) => {
        const isSelected = note.id === selectedNoteId;
        return (
          <div
            key={note.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectNote(note.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNote(note.id); }}
            className={`w-full text-left px-3 py-2.5 border-b border-obsidian-border/10 transition-all duration-100 group cursor-pointer border-l-2 ${
              isSelected
                ? 'bg-obsidian-raised text-ui-text border-l-phosphor'
                : 'text-ui-muted hover:bg-obsidian-surface hover:text-ui-text border-l-transparent hover:border-l-obsidian-border'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText
                size={12}
                strokeWidth={1.5}
                className={`shrink-0 ${isSelected ? 'text-phosphor' : 'text-ui-dim'}`}
              />
              <span className="flex-1 text-xs font-mono truncate">
                {note.title || note.filename}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNote(note.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-ui-dim hover:text-red-400 transition-all"
                title="Delete note"
                aria-label={`Delete ${note.title || note.filename}`}
              >
                <Trash2 size={10} strokeWidth={1.5} />
              </button>
            </div>
            {note.tags && note.tags.length > 0 && (
              <div className="flex gap-1 mt-1 ml-5">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono text-ui-dim bg-obsidian-surface px-1"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
