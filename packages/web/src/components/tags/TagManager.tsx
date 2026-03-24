import { useState } from 'react';
import { Tag, Plus, Minus, X } from 'lucide-react';
import { useNotes, useUpdateNote } from '../../hooks/use-notes';
import { useActiveCollection } from '../../context/CollectionContext';

interface TagManagerProps {
  readonly onFilterByTag: (tag: string) => void;
  readonly activeTag?: string;
}

export function TagManager({ onFilterByTag, activeTag }: TagManagerProps) {
  const { activeCollectionId } = useActiveCollection();
  const { data: notesData } = useNotes({
    collectionId: activeCollectionId,
    pageSize: 100,
  });
  const updateNote = useUpdateNote();

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState('');

  const notes = notesData?.data ?? [];

  // Build tag → count map and tag → noteIds map
  const tagCounts = new Map<string, number>();
  const tagNoteIds = new Map<string, string[]>();
  for (const note of notes) {
    for (const tag of note.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      const ids = tagNoteIds.get(tag) ?? [];
      ids.push(note.id);
      tagNoteIds.set(tag, ids);
    }
  }

  // Sort by count descending
  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  const toggleTagSelection = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const handleBulkRemove = async () => {
    for (const tag of selectedTags) {
      const noteIds = tagNoteIds.get(tag) ?? [];
      for (const noteId of noteIds) {
        const note = notes.find((n) => n.id === noteId);
        if (!note) continue;
        const currentTags = (note.tags ?? []) as string[];
        const updatedTags = currentTags.filter((t) => !selectedTags.has(t));
        await updateNote.mutateAsync({ id: noteId, tags: updatedTags });
      }
    }
    setSelectedTags(new Set());
    setBulkMode(false);
  };

  const handleBulkAdd = async () => {
    const tagToAdd = newTag.trim().replace(/^#/, '');
    if (!tagToAdd) return;
    for (const note of notes) {
      const currentTags = (note.tags ?? []) as string[];
      if (!currentTags.includes(tagToAdd)) {
        await updateNote.mutateAsync({
          id: note.id,
          tags: [...currentTags, tagToAdd],
        });
      }
    }
    setNewTag('');
  };

  if (sortedTags.length === 0 && !bulkMode) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Tag size={12} strokeWidth={1.5} className="text-ui-dim" />
            <span className="text-xs font-mono text-ui-dim uppercase tracking-wider">
              Tags
            </span>
          </div>
          <button
            onClick={() => setBulkMode(true)}
            className="text-[10px] font-mono text-ui-dim hover:text-phosphor transition-colors"
          >
            + Add
          </button>
        </div>
        <div className="text-xs font-mono text-ui-dim">
          No tags found. Add tags to your notes to organize them.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag size={12} strokeWidth={1.5} className="text-ui-dim" />
          <span className="text-xs font-mono text-ui-dim uppercase tracking-wider">
            Tags
          </span>
        </div>
        <button
          onClick={() => {
            setBulkMode(!bulkMode);
            setSelectedTags(new Set());
          }}
          className={`text-[10px] font-mono transition-colors ${
            bulkMode ? 'text-phosphor' : 'text-ui-dim hover:text-phosphor'
          }`}
        >
          {bulkMode ? 'Done' : 'Bulk Edit'}
        </button>
      </div>

      {/* Bulk add tag input */}
      {bulkMode && (
        <div className="flex items-center gap-1 mb-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleBulkAdd();
            }}
            placeholder="Add tag to all notes..."
            className="flex-1 bg-obsidian-raised px-2 py-1 text-[10px] font-mono text-ui-text outline-none placeholder:text-ui-dim"
          />
          <button
            onClick={() => void handleBulkAdd()}
            disabled={!newTag.trim()}
            className="p-1 text-ui-dim hover:text-phosphor disabled:opacity-30 transition-colors"
            title="Add tag to all notes"
          >
            <Plus size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Bulk remove selected */}
      {bulkMode && selectedTags.size > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => void handleBulkRemove()}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-red-400 bg-obsidian-raised hover:bg-red-400/10 transition-colors"
          >
            <Minus size={10} strokeWidth={1.5} />
            Remove {selectedTags.size} tag{selectedTags.size > 1 ? 's' : ''} from all notes
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {sortedTags.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => {
              if (bulkMode) {
                toggleTagSelection(tag);
              } else {
                onFilterByTag(activeTag === tag ? '' : tag);
              }
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono transition-colors ${
              bulkMode && selectedTags.has(tag)
                ? 'text-red-300 bg-red-400/20 ring-1 ring-red-400/40'
                : activeTag === tag
                  ? 'text-obsidian-base bg-phosphor'
                  : 'text-ui-muted bg-obsidian-raised hover:text-phosphor'
            }`}
          >
            {bulkMode && selectedTags.has(tag) && (
              <X size={8} strokeWidth={2} />
            )}
            #{tag}
            <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
