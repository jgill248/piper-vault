import { useState } from 'react';
import { Tag, Plus, Minus, X, ArrowRight } from 'lucide-react';
import { useNotes, useUpdateNote } from '../../hooks/use-notes';
import { useRenameTag, useDeleteTag } from '../../hooks/use-sources';
import { useActiveCollection } from '../../context/CollectionContext';
import { useToast } from '../../context/ToastContext';

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
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const { addToast } = useToast();

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState('');
  const [renameValue, setRenameValue] = useState('');

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
    const tags = [...selectedTags];
    try {
      // Server-side removal covers every source carrying the tag, not just
      // the notes loaded in this panel.
      for (const tag of tags) {
        await deleteTag.mutateAsync({ tag, collectionId: activeCollectionId });
      }
      addToast(`Removed ${tags.length} tag${tags.length > 1 ? 's' : ''} from the vault`, 'success');
      if (activeTag && tags.includes(activeTag)) onFilterByTag('');
    } catch {
      addToast('Failed to remove tags', 'error');
    }
    setSelectedTags(new Set());
    setBulkMode(false);
  };

  const singleSelectedTag = selectedTags.size === 1 ? [...selectedTags][0] : undefined;
  const renameTarget = renameValue.trim().replace(/^#/, '');
  const isMerge = renameTarget.length > 0 && tagCounts.has(renameTarget);

  const handleRename = async () => {
    if (!singleSelectedTag || !renameTarget || renameTarget === singleSelectedTag) return;
    try {
      const result = await renameTag.mutateAsync({
        oldTag: singleSelectedTag,
        newTag: renameTarget,
        collectionId: activeCollectionId,
      });
      addToast(
        `${isMerge ? 'Merged' : 'Renamed'} #${singleSelectedTag} → #${renameTarget} (${result.affectedCount} note${result.affectedCount === 1 ? '' : 's'})`,
        'success',
      );
      if (activeTag === singleSelectedTag) onFilterByTag('');
    } catch {
      addToast(`Failed to rename #${singleSelectedTag}`, 'error');
    }
    setRenameValue('');
    setSelectedTags(new Set());
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

      {/* Rename / merge — available when exactly one tag is selected */}
      {bulkMode && singleSelectedTag && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] font-label text-secondary truncate max-w-[80px]">
            #{singleSelectedTag}
          </span>
          <ArrowRight size={10} strokeWidth={1.5} className="text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename();
            }}
            placeholder="New tag name..."
            className="flex-1 min-w-0 bg-surface-container-high px-2 py-1 text-[10px] font-label text-on-surface outline-none placeholder:text-on-surface-variant"
          />
          <button
            onClick={() => void handleRename()}
            disabled={!renameTarget || renameTarget === singleSelectedTag || renameTag.isPending}
            className="px-2 py-1 text-[10px] font-label text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors shrink-0"
            title={isMerge ? `Merge into existing #${renameTarget}` : 'Rename tag everywhere'}
          >
            {renameTag.isPending ? '...' : isMerge ? 'Merge' : 'Rename'}
          </button>
        </div>
      )}

      {/* Bulk remove selected */}
      {bulkMode && selectedTags.size > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => void handleBulkRemove()}
            disabled={deleteTag.isPending}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-label text-red-400 bg-surface-container-high hover:bg-red-400/10 disabled:opacity-40 transition-colors"
          >
            <Minus size={10} strokeWidth={1.5} />
            {deleteTag.isPending
              ? 'Removing...'
              : `Remove ${selectedTags.size} tag${selectedTags.size > 1 ? 's' : ''} everywhere`}
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
            title={`#${tag} (${count})`}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-label transition-colors max-w-[200px] ${
              bulkMode && selectedTags.has(tag)
                ? 'text-red-300 bg-red-400/20 ring-1 ring-red-400/40'
                : activeTag === tag
                  ? 'text-background bg-primary'
                  : 'text-secondary bg-surface-container-high hover:text-primary'
            }`}
          >
            {bulkMode && selectedTags.has(tag) && (
              <X size={8} strokeWidth={2} className="shrink-0" />
            )}
            <span className="truncate">#{tag}</span>
            <span className="opacity-60 shrink-0">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
