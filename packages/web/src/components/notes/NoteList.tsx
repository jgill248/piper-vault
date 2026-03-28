import { useState, useRef, useEffect } from 'react';
import { FileText, Trash2, FolderInput } from 'lucide-react';
import type { Source, NoteFolder } from '@delve/shared';

interface NoteListProps {
  readonly notes: readonly Source[];
  readonly selectedNoteId: string | undefined;
  readonly onSelectNote: (id: string) => void;
  readonly onDeleteNote: (id: string) => void;
  readonly onMoveNote: (id: string, parentPath: string | null) => void;
  readonly folders: readonly NoteFolder[];
  readonly isLoading: boolean;
}

function MoveFolderMenu({
  folders,
  currentPath,
  onMove,
  onClose,
}: {
  folders: readonly NoteFolder[];
  currentPath: string | null | undefined;
  onMove: (path: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-0.5 min-w-[140px] bg-obsidian-raised border border-obsidian-border/30 shadow-lg"
    >
      <div className="px-2 py-1 border-b border-obsidian-border/20">
        <span className="text-[9px] font-mono text-ui-dim uppercase tracking-wider">Move to folder</span>
      </div>
      <button
        onClick={() => { onMove(null); onClose(); }}
        className={`w-full text-left px-2 py-1.5 text-xs font-mono transition-colors hover:bg-obsidian-surface ${
          !currentPath ? 'text-phosphor' : 'text-ui-muted hover:text-ui-text'
        }`}
      >
        / (root)
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => { onMove(folder.path); onClose(); }}
          className={`w-full text-left px-2 py-1.5 text-xs font-mono transition-colors hover:bg-obsidian-surface ${
            currentPath === folder.path ? 'text-phosphor' : 'text-ui-muted hover:text-ui-text'
          }`}
        >
          {folder.path}
        </button>
      ))}
      {folders.length === 0 && (
        <div className="px-2 py-1.5 text-[10px] font-mono text-ui-dim">No folders yet</div>
      )}
    </div>
  );
}

export function NoteList({
  notes,
  selectedNoteId,
  onSelectNote,
  onDeleteNote,
  onMoveNote,
  folders,
  isLoading,
}: NoteListProps) {
  const [moveMenuNoteId, setMoveMenuNoteId] = useState<string | undefined>(undefined);

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
        const showMoveMenu = moveMenuNoteId === note.id;
        return (
          <div
            key={note.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectNote(note.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNote(note.id); }}
            className={`relative w-full text-left px-3 py-2.5 border-b border-obsidian-border/10 transition-all duration-100 group cursor-pointer border-l-2 ${
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
                  setMoveMenuNoteId(showMoveMenu ? undefined : note.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-ui-dim hover:text-phosphor transition-all"
                title="Move to folder"
                aria-label={`Move ${note.title || note.filename} to folder`}
              >
                <FolderInput size={10} strokeWidth={1.5} />
              </button>
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
            {showMoveMenu && (
              <MoveFolderMenu
                folders={folders}
                currentPath={note.parentPath}
                onMove={(path) => onMoveNote(note.id, path)}
                onClose={() => setMoveMenuNoteId(undefined)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
