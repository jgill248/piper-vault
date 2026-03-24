import { useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  readonly tags: readonly string[];
  readonly onChange: (tags: string[]) => void;
  readonly placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Add tag...' }: TagInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = input.trim().replace(/^#/, '');
        if (tag && !tags.includes(tag)) {
          onChange([...tags, tag]);
        }
        setInput('');
      }
      if (e.key === 'Backspace' && input === '' && tags.length > 0) {
        onChange([...tags.slice(0, -1)]);
      }
    },
    [input, tags, onChange],
  );

  const handleRemove = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-obsidian-border/20 bg-obsidian-surface">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-phosphor bg-obsidian-raised"
        >
          #{tag}
          <button
            onClick={() => handleRemove(tag)}
            className="hover:text-red-400 transition-colors"
          >
            <X size={8} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-[80px] bg-transparent text-xs font-mono text-ui-text outline-none placeholder:text-ui-dim"
        placeholder={tags.length === 0 ? placeholder : ''}
      />
    </div>
  );
}
