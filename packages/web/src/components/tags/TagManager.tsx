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
            <Tag size={12} strokeWidth={1.5} className="text-on-surface-variant" />
            <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
              Tags
            </span>
          </div>
          <button
            onClick={() => setBulkMode(true)}
            className="text-[10px] font-label text-on-surface-variant hover:text-primary transition-colors"
          >
            + Add
          </button>
        </div>
        <div className="text-xs font-label text-on-surface-variant">
          No tags found. Add tags to your notes to organize them.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag size={12} strokeWidth={1.5} className="text-on-surface-variant" />
          <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
            Tags
          </span>
        </div>
        <button
          onClick={() => {
            setBulkMode(!bulkMode);
            setSelectedTags(new Set());
          }}
          className={`text-[10px] font-label transition-colors ${
            bulkMode ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
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
            className="flex-1 bg-surface-container-high px-2 py-1 text-[10px] font-label text-on-surface outline-none placeholder:text-on-surface-variant"
          />
          <button
            onClick={() => void handleBulkAdd()}
            disabled={!newTag.trim()}
            className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors"
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
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-label text-red-400 bg-surface-container-high hover:bg-red-400/10 transition-colors"
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
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-label transition-colors ${
              bulkMode && selectedTags.has(tag)
                ? 'text-red-300 bg-red-400/20 ring-1 ring-red-400/40'
                : activeTag === tag
                  ? 'text-background bg-primary'
                  : 'text-secondary bg-surface-container-high hover:text-primary'
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
