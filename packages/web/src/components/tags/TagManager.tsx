import { useState } from 'react';
import { Tag, Filter } from 'lucide-react';
import { useNotes } from '../../hooks/use-notes';
import { useActiveCollection } from '../../context/CollectionContext';
import type { Source } from '@delve/shared';

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

  const notes = notesData?.data ?? [];

  // Build tag → count map
  const tagCounts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Sort by count descending
  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  if (sortedTags.length === 0) {
    return (
      <div className="p-3 text-xs font-mono text-ui-dim">
        No tags found. Add tags to your notes to organize them.
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Tag size={12} strokeWidth={1.5} className="text-ui-dim" />
        <span className="text-xs font-mono text-ui-dim uppercase tracking-wider">
          Tags
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sortedTags.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => onFilterByTag(activeTag === tag ? '' : tag)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono transition-colors ${
              activeTag === tag
                ? 'text-obsidian-base bg-phosphor'
                : 'text-ui-muted bg-obsidian-raised hover:text-phosphor'
            }`}
          >
            #{tag}
            <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
