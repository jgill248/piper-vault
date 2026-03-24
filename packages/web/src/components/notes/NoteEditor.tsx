import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Eye, Edit3, Link } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface NoteEditorProps {
  readonly noteId?: string;
  readonly initialContent: string;
  readonly initialTitle: string;
  readonly onSave: (content: string, title: string) => void;
  readonly noteNames?: readonly string[];
}

export function NoteEditor({
  noteId,
  initialContent,
  initialTitle,
  onSave,
  noteNames = [],
}: NoteEditorProps) {
  // Reset state when note identity changes using React's recommended
  // "adjusting state during rendering" pattern (no useEffect needed).
  const [prevNoteId, setPrevNoteId] = useState(noteId);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [isDirty, setIsDirty] = useState(false);

  if (noteId !== prevNoteId) {
    setPrevNoteId(noteId);
    setContent(initialContent);
    setTitle(initialTitle);
    setIsDirty(false);
  }

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave(content, title);
      setIsDirty(false);
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, title, isDirty, onSave]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      setIsDirty(true);

      // Check for wiki-link autocomplete trigger
      const cursorPos = e.target.selectionStart;
      const textBefore = value.slice(0, cursorPos);
      const match = /\[\[([^\]]*?)$/.exec(textBefore);
      if (match) {
        setShowAutocomplete(true);
        setAutocompleteFilter(match[1] ?? '');
      } else {
        setShowAutocomplete(false);
      }
    },
    [],
  );

  const handleAutocompleteSelect = useCallback(
    (name: string) => {
      if (!textareaRef.current) return;
      const cursorPos = textareaRef.current.selectionStart;
      const textBefore = content.slice(0, cursorPos);
      const textAfter = content.slice(cursorPos);

      // Find the [[ trigger
      const match = /\[\[([^\]]*?)$/.exec(textBefore);
      if (!match) return;

      const beforeLink = textBefore.slice(0, match.index);
      const newContent = `${beforeLink}[[${name}]]${textAfter}`;
      setContent(newContent);
      setIsDirty(true);
      setShowAutocomplete(false);

      // Set cursor after the inserted link
      const newPos = beforeLink.length + name.length + 4;
      setTimeout(() => {
        textareaRef.current?.setSelectionRange(newPos, newPos);
        textareaRef.current?.focus();
      }, 0);
    },
    [content],
  );

  const filteredNames = noteNames.filter((n) =>
    n.toLowerCase().includes(autocompleteFilter.toLowerCase()),
  );

  const handleManualSave = useCallback(() => {
    onSave(content, title);
    setIsDirty(false);
  }, [content, title, onSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-obsidian-border/20">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          className="flex-1 bg-transparent font-display text-lg text-ui-text outline-none placeholder:text-ui-dim"
          placeholder="Note title..."
        />
        <div className="flex items-center gap-1">
          {isDirty && (
            <span className="text-xs font-mono text-ui-dim mr-2">unsaved</span>
          )}
          <button
            onClick={handleManualSave}
            className="p-1.5 text-ui-dim hover:text-phosphor transition-colors"
            title="Save"
          >
            <Save size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
            className="p-1.5 text-ui-dim hover:text-phosphor transition-colors"
            title={mode === 'edit' ? 'Preview' : 'Edit'}
          >
            {mode === 'edit' ? (
              <Eye size={14} strokeWidth={1.5} />
            ) : (
              <Edit3 size={14} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-auto relative">
        {mode === 'edit' ? (
          <div className="relative h-full">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              className="w-full h-full bg-transparent font-mono text-sm text-ui-text p-4 outline-none resize-none"
              placeholder="Start writing... Use [[Note Name]] for wiki-links"
              spellCheck={false}
            />
            {/* Wiki-link autocomplete dropdown */}
            {showAutocomplete && filteredNames.length > 0 && (
              <div className="absolute left-4 top-8 z-50 bg-obsidian-surface border border-obsidian-border/40 max-h-48 overflow-auto w-64">
                {filteredNames.slice(0, 10).map((name) => (
                  <button
                    key={name}
                    onClick={() => handleAutocompleteSelect(name)}
                    className="w-full text-left px-3 py-1.5 text-xs font-mono text-ui-text hover:bg-obsidian-raised hover:text-phosphor transition-colors flex items-center gap-2"
                  >
                    <Link size={10} strokeWidth={1.5} />
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
