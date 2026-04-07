import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, AlertTriangle, FileText } from 'lucide-react';
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

export function NotesPanel() {
  const { activeCollectionId } = useActiveCollection();
  const { pendingNoteId, clearPendingNote } = useNavigation();
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<NoteEditorHandle>(null);

  // Handle navigation from other panels (e.g., graph → note)
  useEffect(() => {
    if (pendingNoteId) {
      setSelectedNoteId(pendingNoteId);
      clearPendingNote();
    }
  }, [pendingNoteId, clearPendingNote]);

  // Clear selected note when user explicitly switches folders
  const handleSelectPath = useCallback((path: string | undefined) => {
    setSelectedPath(path);
    setSelectedNoteId(undefined);
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
  // Fetch selected note independently for cross-folder navigation
  const { data: selectedNoteData } = useNote(
    selectedNoteId && !notes.find((n) => n.id === selectedNoteId) ? selectedNoteId : undefined,
  );
  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? selectedNoteData ?? undefined;

  // Auto-switch folder when navigating to a note in a different path
  useEffect(() => {
    if (selectedNoteData && selectedNoteData.parentPath !== (selectedPath ?? '')) {
      setSelectedPath(selectedNoteData.parentPath ?? undefined);
    }
  }, [selectedNoteData, selectedPath]);

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

  const handleCreateNote = useCallback(() => {
    setError(null);
    createNote.mutate(
      {
        title: 'Untitled Note',
        content: '',
        collectionId: activeCollectionId,
        parentPath: selectedPath ?? null,
      },
      {
        onSuccess: (result) => {
          setSelectedNoteId(result.sourceId);
        },
        onError: (err) => {
          setError(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
        },
      },
    );
  }, [createNote, activeCollectionId, selectedPath]);

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

  return (
    <div className="flex flex-col h-full">
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
      <div className="flex flex-1 min-h-0">
      {/* Left panel: Folders + Note list */}
      <div className="w-64 flex flex-col border-r border-outline-variant/20 bg-surface">
        {/* Folder tree */}
        <div className="h-48 border-b border-outline-variant/20 overflow-auto">
          <FolderTree
            folders={folders ?? []}
            selectedPath={selectedPath}
            onSelectPath={handleSelectPath}
            onCreateFolder={handleCreateFolder}
          />
        </div>

        {/* Note list header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20">
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
            onSelectNote={setSelectedNoteId}
            onDeleteNote={handleDeleteNote}
            onMoveNote={handleMoveNote}
            folders={folders ?? []}
            isLoading={notesLoading}
          />
        </div>
      </div>

      {/* Right panel: Editor + Backlinks */}
      <div className="flex-1 flex flex-col bg-surface-container">
        {selectedNote ? (
          <>
            <div className="flex-1 overflow-hidden">
              <NoteEditor
                ref={editorRef}
                noteId={selectedNote.id}
                initialContent={selectedNote.content ?? ''}
                initialTitle={selectedNote.title ?? selectedNote.filename}
                onSave={handleSaveNote}
                noteNames={allNoteNames}
                noteMap={noteMap}
                onNavigateToNote={setSelectedNoteId}
              />
            </div>
            <div className="max-h-64 overflow-auto">
              <BacklinksPanel
                noteId={selectedNote.id}
                onNavigateToNote={setSelectedNoteId}
              />
              <SuggestionsPanel
                noteId={selectedNote.id}
                onNavigateToNote={setSelectedNoteId}
                onInsertLink={(title) => editorRef.current?.insertLink(title)}
              />
            </div>
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
