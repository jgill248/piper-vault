import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import { useNotes, useNote, useCreateNote, useUpdateNote, useDeleteNote } from '../../hooks/use-notes';
import { useFolders, useCreateFolder } from '../../hooks/use-folders';
import { useActiveCollection } from '../../context/CollectionContext';
import { useNavigation } from '../../context/NavigationContext';
import { FolderTree } from './FolderTree';
import { NoteList } from './NoteList';
import { NoteEditor } from './NoteEditor';
import type { NoteEditorHandle } from './NoteEditor';
import { BacklinksPanel } from './BacklinksPanel';
import { SuggestionsPanel } from './SuggestionsPanel';

/**
 * A note that has not been persisted yet. Created entirely in memory
 * when the user clicks "+ NEW NOTE". The note is only POSTed when the
 * user first edits the title or content.
 */
interface DraftNote {
  readonly isDraft: true;
  readonly id: '__draft__';
  readonly title: string;
  readonly content: string;
  readonly parentPath: string | null;
}

export function NotesPanel() {
  const { activeCollectionId } = useActiveCollection();
  const { pendingNoteId, clearPendingNote } = useNavigation();
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<NoteEditorHandle>(null);

  // Draft note state (Bug 3 — in-memory draft, not yet persisted)
  const [draftNote, setDraftNote] = useState<DraftNote | null>(null);
  // When a draft is being persisted this holds the in-flight promise so
  // concurrent edits don't fire two POSTs.
  const draftPersistingRef = useRef(false);

  // Mobile: track whether to show the editor pane or the list/folder pane.
  // On >= md the layout is always side-by-side; this flag only matters on < md.
  const [mobileShowEditor, setMobileShowEditor] = useState(false);

  // Handle navigation from other panels (e.g., graph → note).
  // Adjust state during render to avoid cascading effect re-renders.
  if (pendingNoteId && selectedNoteId !== pendingNoteId) {
    setSelectedNoteId(pendingNoteId);
    // Clear any in-flight draft when navigating away
    setDraftNote(null);
    // Show editor pane on mobile when navigating to a note
    setMobileShowEditor(true);
  }
  useEffect(() => {
    if (pendingNoteId) clearPendingNote();
  }, [pendingNoteId, clearPendingNote]);

  // Clear selected note when user explicitly switches folders
  const handleSelectPath = useCallback((path: string | undefined) => {
    setSelectedPath(path);
    setSelectedNoteId(undefined);
    setDraftNote(null);
    setMobileShowEditor(false);
  }, []);

  const { data: notesData, isLoading: notesLoading } = useNotes({
    collectionId: activeCollectionId,
    parentPath: selectedPath ?? '',
  });
  const { data: folders } = useFolders(activeCollectionId);

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createFolder = useCreateFolder();

  const notes = notesData?.data ?? [];

  // Bug 2 fix: fetch the selected note independently so cross-folder
  // navigation works even when the note is not in the current path filter.
  const { data: selectedNoteData } = useNote(
    selectedNoteId && !notes.find((n) => n.id === selectedNoteId) ? selectedNoteId : undefined,
  );
  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? selectedNoteData ?? undefined;

  // Bug 2 fix: Auto-switch folder when navigating to a note in a different path.
  // Adjust state during render to avoid cascading effect re-renders.
  if (selectedNoteData && selectedNoteData.parentPath !== (selectedPath ?? '')) {
    setSelectedPath(selectedNoteData.parentPath ?? undefined);
  }

  // Get all note names for autocomplete
  const allNotesQuery = useNotes({ collectionId: activeCollectionId, pageSize: 100 });
  const allNoteNames = (allNotesQuery.data?.data ?? [])
    .map((n) => (n.title || n.filename).replace(/\.md$/, ''));

  const noteMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const note of allNotesQuery.data?.data ?? []) {
      const name = (note.title || note.filename).replace(/\.md$/, '');
      map.set(name.toLowerCase(), note.id);
    }
    return map;
  }, [allNotesQuery.data]);

  // Bug 3 fix: open an in-memory draft instead of immediately persisting.
  const handleCreateNote = useCallback(() => {
    setError(null);
    setDraftNote({
      isDraft: true,
      id: '__draft__',
      title: '',
      content: '',
      parentPath: selectedPath ?? null,
    });
    setSelectedNoteId(undefined);
    setMobileShowEditor(true);
  }, [selectedPath]);

  /**
   * Called by NoteEditor's onSave for the draft note.
   * On the very first edit (title or content non-empty) we persist the note.
   */
  const handleSaveDraft = useCallback(
    (content: string, title: string) => {
      if (draftPersistingRef.current) return;
      // Don't persist a completely untouched draft.
      const effectiveTitle = title.trim() || 'Untitled Note';
      if (!title.trim() && !content.trim()) return;
      draftPersistingRef.current = true;
      createNote.mutate(
        {
          title: effectiveTitle,
          content,
          collectionId: activeCollectionId,
          parentPath: draftNote?.parentPath ?? null,
        },
        {
          onSuccess: (result) => {
            setDraftNote(null);
            setSelectedNoteId(result.sourceId);
            draftPersistingRef.current = false;
          },
          onError: (err) => {
            draftPersistingRef.current = false;
            setError(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
          },
        },
      );
    },
    [createNote, activeCollectionId, draftNote],
  );

  const handleSaveNote = useCallback(
    (content: string, title: string) => {
      if (!selectedNoteId) return;
      setError(null);
      updateNote.mutate(
        { id: selectedNoteId, content, title },
        {
          onError: (err) => {
            setError(`Failed to save note: ${err instanceof Error ? err.message : String(err)}`);
          },
        },
      );
    },
    [selectedNoteId, updateNote],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNote.mutate(id);
      if (selectedNoteId === id) {
        setSelectedNoteId(undefined);
        setMobileShowEditor(false);
      }
    },
    [deleteNote, selectedNoteId],
  );

  const handleMoveNote = useCallback(
    (id: string, parentPath: string | null) => {
      updateNote.mutate({ id, parentPath });
    },
    [updateNote],
  );

  const handleCreateFolder = useCallback(
    (path: string, onSuccess?: () => void) => {
      setError(null);
      createFolder.mutate(
        { path, collectionId: activeCollectionId },
        {
          onSuccess,
          onError: (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            setError(
              msg.toLowerCase().includes('already exists')
                ? `Folder "${path}" already exists`
                : `Failed to create folder: ${msg}`,
            );
          },
        },
      );
    },
    [createFolder, activeCollectionId],
  );

  // When a note is selected from the list on mobile, show the editor pane.
  const handleSelectNote = useCallback(
    (id: string) => {
      setSelectedNoteId(id);
      setDraftNote(null);
      setMobileShowEditor(true);
    },
    [],
  );

  // Navigate back to list pane on mobile
  const handleBackToList = useCallback(() => {
    setMobileShowEditor(false);
  }, []);

  // The editor is active when either a real note or a draft is open.
  const hasEditorContent = Boolean(selectedNote ?? draftNote);

  // Derive editor props from draft or real note.
  const editorNoteId = draftNote ? undefined : selectedNote?.id;
  const editorInitialContent = draftNote ? draftNote.content : (selectedNote?.content ?? '');
  const editorInitialTitle = draftNote
    ? draftNote.title
    : (selectedNote?.title ?? selectedNote?.filename ?? '');
  const editorOnSave = draftNote ? handleSaveDraft : handleSaveNote;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border-b border-red-400/30">
          <AlertTriangle size={12} strokeWidth={1.5} className="text-red-400 shrink-0" />
          <span className="text-xs font-label text-red-300 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-label text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/*
          Left panel: Folders + Note list
          - On < md: shown only when mobileShowEditor is false
          - On >= md: always visible (w-64)
        */}
        <div
          className={`
            flex flex-col border-r border-outline-variant/20 bg-surface
            md:w-64 md:shrink-0 md:flex
            ${mobileShowEditor ? 'hidden' : 'flex w-full'}
          `}
        >
          {/* Folder tree */}
          <div className="h-48 border-b border-outline-variant/20 overflow-auto shrink-0">
            <FolderTree
              folders={folders ?? []}
              selectedPath={selectedPath}
              onSelectPath={handleSelectPath}
              onCreateFolder={handleCreateFolder}
            />
          </div>

          {/* Note list header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20 shrink-0">
            <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
              Notes
            </span>
            <button
              onClick={handleCreateNote}
              className="p-1 text-on-surface-variant hover:text-primary transition-colors"
              title="New note"
              disabled={createNote.isPending}
            >
              <Plus size={12} strokeWidth={1.5} />
            </button>
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-auto">
            <NoteList
              notes={notes}
              selectedNoteId={selectedNoteId}
              onSelectNote={handleSelectNote}
              onDeleteNote={handleDeleteNote}
              onMoveNote={handleMoveNote}
              folders={folders ?? []}
              isLoading={notesLoading}
            />
          </div>
        </div>

        {/*
          Right panel: Editor + Backlinks
          - On < md: shown only when mobileShowEditor is true
          - On >= md: always visible (flex-1)
        */}
        <div
          className={`
            flex-1 min-w-0 flex flex-col bg-surface-container
            md:flex
            ${mobileShowEditor ? 'flex w-full' : 'hidden'}
          `}
        >
          {hasEditorContent ? (
            <>
              {/* Mobile back button — only visible below md */}
              <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-outline-variant/20 bg-surface shrink-0">
                <button
                  onClick={handleBackToList}
                  className="flex items-center gap-1.5 text-xs font-label text-secondary hover:text-primary transition-colors"
                  aria-label="Back to note list"
                >
                  <ArrowLeft size={13} strokeWidth={1.5} />
                  Back to list
                </button>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <NoteEditor
                  ref={editorRef}
                  noteId={editorNoteId}
                  initialContent={editorInitialContent}
                  initialTitle={editorInitialTitle}
                  onSave={editorOnSave}
                  noteNames={allNoteNames}
                  noteMap={noteMap}
                  onNavigateToNote={handleSelectNote}
                />
              </div>
              {/* Backlinks and suggestions are only relevant for persisted notes */}
              {selectedNote && (
                <div className="max-h-64 overflow-auto shrink-0">
                  <BacklinksPanel
                    noteId={selectedNote.id}
                    onNavigateToNote={handleSelectNote}
                  />
                  <SuggestionsPanel
                    noteId={selectedNote.id}
                    onNavigateToNote={handleSelectNote}
                    onInsertLink={(title) => editorRef.current?.insertLink(title)}
                    knownNotes={allNotesQuery.data?.data}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs space-y-4">
                <div className="border border-primary/20 p-6 bg-surface/50 mx-auto w-fit">
                  <FileText size={28} className="text-primary/40" strokeWidth={1} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-headline font-semibold text-on-surface">
                    Select a note or create a new one
                  </p>
                  <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">
                    Ctrl+N to create quickly
                  </p>
                </div>
                <button onClick={handleCreateNote} className="btn-primary text-xs">
                  NEW NOTE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
