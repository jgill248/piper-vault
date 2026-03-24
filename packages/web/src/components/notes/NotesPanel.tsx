import { useState, useCallback } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../../hooks/use-notes';
import { useFolders, useCreateFolder } from '../../hooks/use-folders';
import { useActiveCollection } from '../../context/CollectionContext';
import { FolderTree } from './FolderTree';
import { NoteList } from './NoteList';
import { NoteEditor } from './NoteEditor';
import { BacklinksPanel } from './BacklinksPanel';

export function NotesPanel() {
  const { activeCollectionId } = useActiveCollection();
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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
  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  // Get all note names for autocomplete
  const allNotesQuery = useNotes({ collectionId: activeCollectionId, pageSize: 100 });
  const allNoteNames = (allNotesQuery.data?.data ?? [])
    .map((n) => (n.title || n.filename).replace(/\.md$/, ''));

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

  const handleCreateFolder = useCallback(
    (path: string) => {
      createFolder.mutate({ path, collectionId: activeCollectionId });
    },
    [createFolder, activeCollectionId],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border-b border-red-400/30">
          <AlertTriangle size={12} strokeWidth={1.5} className="text-red-400 shrink-0" />
          <span className="text-xs font-mono text-red-300 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-mono text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Left panel: Folders + Note list */}
      <div className="w-64 flex flex-col border-r border-obsidian-border/20 bg-obsidian-surface">
        {/* Folder tree */}
        <div className="h-48 border-b border-obsidian-border/20 overflow-auto">
          <FolderTree
            folders={folders ?? []}
            selectedPath={selectedPath}
            onSelectPath={setSelectedPath}
            onCreateFolder={handleCreateFolder}
          />
        </div>

        {/* Note list header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-obsidian-border/20">
          <span className="text-xs font-mono text-ui-dim uppercase tracking-wider">
            Notes
          </span>
          <button
            onClick={handleCreateNote}
            className="p-1 text-ui-dim hover:text-phosphor transition-colors"
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
            isLoading={notesLoading}
          />
        </div>
      </div>

      {/* Right panel: Editor + Backlinks */}
      <div className="flex-1 flex flex-col bg-obsidian-sunken">
        {selectedNote ? (
          <>
            <div className="flex-1 overflow-hidden">
              <NoteEditor
                noteId={selectedNote.id}
                initialContent={selectedNote.content ?? ''}
                initialTitle={selectedNote.title ?? selectedNote.filename}
                onSave={handleSaveNote}
                noteNames={allNoteNames}
              />
            </div>
            <BacklinksPanel
              noteId={selectedNote.id}
              onNavigateToNote={setSelectedNoteId}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-mono text-ui-dim mb-2">
                Select a note or create a new one
              </p>
              <button onClick={handleCreateNote} className="btn-primary text-xs">
                New Note
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
