import { ArrowLeft } from 'lucide-react';
import { useBacklinks } from '../../hooks/use-notes';

interface BacklinksPanelProps {
  readonly noteId: string;
  readonly onNavigateToNote: (id: string) => void;
}

export function BacklinksPanel({ noteId, onNavigateToNote }: BacklinksPanelProps) {
  const { data: backlinks, isLoading } = useBacklinks(noteId);

  if (isLoading) {
    return (
      <div className="p-3 text-xs font-mono text-ui-dim">Loading backlinks...</div>
    );
  }

  if (!backlinks || backlinks.length === 0) {
    return (
      <div className="p-3 text-xs font-mono text-ui-dim">No backlinks found.</div>
    );
  }

  return (
    <div className="border-t border-obsidian-border/20">
      <div className="px-3 py-2">
        <span className="text-xs font-mono text-ui-dim uppercase tracking-wider">
          Backlinks ({backlinks.length})
        </span>
      </div>
      <div className="flex flex-col">
        {backlinks.map((entry) => (
          <button
            key={entry.link.id}
            onClick={() => onNavigateToNote(entry.link.sourceId)}
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-ui-muted hover:text-phosphor hover:bg-obsidian-surface transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={10} strokeWidth={1.5} />
            <span className="truncate">
              {entry.sourceTitle || entry.sourceFilename}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
