import { useRef, useEffect, type KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, disabled = false }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore focus after mutation completes (disabled transitions false → true → false)
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    // Auto-resize
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }

  return (
    <div className="border-t border-obsidian-border/30 bg-obsidian-surface px-4 py-3">
      {/* Label */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-[10px] text-ui-dim uppercase tracking-widest">
          INPUT
        </span>
        <div className="flex-1 h-px bg-obsidian-border/20" />
        <span className="font-mono text-[10px] text-ui-dim">SHIFT+ENTER = NEWLINE</span>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-2.5 font-mono text-phosphor text-sm select-none">
            &gt;_
          </span>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder="Enter query..."
            aria-label="Chat message input"
            className="input-cmd pl-10 resize-none overflow-hidden min-h-[40px] max-h-[160px]"
            style={{ lineHeight: '1.5' }}
          />
        </div>

        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="btn-primary shrink-0 h-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          EXECUTE_
        </button>
      </div>
    </div>
  );
}
