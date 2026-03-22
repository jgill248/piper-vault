import { useState } from 'react';
import { X, Pencil, Trash2, Check, Plus } from 'lucide-react';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import type { Collection } from '../../api/client';
import {
  useCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from '../../hooks/use-collections';
import { useActiveCollection } from '../../context/CollectionContext';

type DeleteMode = 'cascade' | 'reassign';

interface ManageCollectionsDialogProps {
  onClose: () => void;
}

export function ManageCollectionsDialog({ onClose }: ManageCollectionsDialogProps) {
  const { data, isLoading } = useCollections();
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const { activeCollectionId, setActiveCollectionId } = useActiveCollection();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('reassign');

  const collections = data?.data ?? [];

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || createCollection.isPending) return;
    createCollection.mutate(
      { name: trimmed, description: newDesc.trim() || undefined },
      {
        onSuccess: () => {
          setNewName('');
          setNewDesc('');
        },
      },
    );
  }

  function handleEditStart(collection: Collection) {
    setEditingId(collection.id);
    setEditName(collection.name);
    setEditDesc(collection.description ?? '');
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  }

  function handleEditSave(id: string) {
    const trimmedName = editName.trim();
    if (!trimmedName || updateCollection.isPending) return;
    updateCollection.mutate(
      { id, input: { name: trimmedName, description: editDesc.trim() || undefined } },
      { onSuccess: () => handleEditCancel() },
    );
  }

  function handleDeleteConfirm(id: string) {
    deleteCollection.mutate(
      { id, mode: deleteMode },
      {
        onSuccess: () => {
          setDeletingId(null);
          if (activeCollectionId === id) {
            setActiveCollectionId(DEFAULT_COLLECTION_ID);
          }
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Manage collections"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-obsidian-base/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-obsidian-surface border border-obsidian-border/30 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border/20 shrink-0">
          <div>
            <h2 className="font-display font-semibold text-ui-text text-sm">Manage Collections</h2>
            <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mt-0.5">
              ORGANIZE · SEGMENT · ISOLATE
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close manage collections"
            className="text-ui-dim hover:text-ui-text transition-colors duration-100 p-1"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Create new */}
        <div className="px-4 py-3 border-b border-obsidian-border/20 shrink-0">
          <p className="font-mono text-[9px] text-phosphor uppercase tracking-widest mb-2">
            NEW_COLLECTION
          </p>
          <form onSubmit={handleCreateSubmit} className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="COLLECTION NAME..."
              aria-label="New collection name"
              className="input-cmd w-full text-[10px]"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="DESCRIPTION (OPTIONAL)..."
              aria-label="New collection description"
              className="input-cmd w-full text-[10px]"
            />
            <button
              type="submit"
              disabled={!newName.trim() || createCollection.isPending}
              className="btn-primary text-[10px] px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Plus size={10} strokeWidth={2} />
              {createCollection.isPending ? 'CREATING...' : 'CREATE_'}
            </button>
          </form>
        </div>

        {/* Collection list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest animate-pulse">
                LOADING...
              </span>
            </div>
          )}

          {!isLoading && collections.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[9px] text-ui-dim uppercase tracking-wider">
                NO COLLECTIONS YET
              </span>
            </div>
          )}

          {!isLoading && collections.length > 0 && (
            <div>
              {/* Default collection row — always shown, non-deletable */}
              <DefaultCollectionRow />

              {collections
                .filter((c) => c.id !== DEFAULT_COLLECTION_ID)
                .map((collection) => (
                  <CollectionRow
                    key={collection.id}
                    collection={collection}
                    isEditing={editingId === collection.id}
                    editName={editName}
                    editDesc={editDesc}
                    onEditNameChange={setEditName}
                    onEditDescChange={setEditDesc}
                    onEditStart={() => handleEditStart(collection)}
                    onEditSave={() => handleEditSave(collection.id)}
                    onEditCancel={handleEditCancel}
                    isDeleting={deletingId === collection.id}
                    deleteMode={deleteMode}
                    onDeleteModeChange={setDeleteMode}
                    onDeleteStart={() => setDeletingId(collection.id)}
                    onDeleteConfirm={() => handleDeleteConfirm(collection.id)}
                    onDeleteCancel={() => setDeletingId(null)}
                    isPendingUpdate={updateCollection.isPending && editingId === collection.id}
                    isPendingDelete={deleteCollection.isPending && deletingId === collection.id}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DefaultCollectionRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-obsidian-border/10 bg-obsidian-sunken/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-ui-text uppercase tracking-wider">Default</span>
          <span className="font-mono text-[8px] text-phosphor uppercase tracking-wider bg-phosphor/10 border border-phosphor/20 px-1.5 py-0.5">
            DEFAULT
          </span>
        </div>
        <p className="font-mono text-[9px] text-ui-dim uppercase tracking-wider mt-0.5">
          CATCH-ALL COLLECTION
        </p>
      </div>
      <span className="font-mono text-[9px] text-ui-dim uppercase tracking-wider">PROTECTED</span>
    </div>
  );
}

interface CollectionRowProps {
  collection: Collection;
  isEditing: boolean;
  editName: string;
  editDesc: string;
  onEditNameChange: (v: string) => void;
  onEditDescChange: (v: string) => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  isDeleting: boolean;
  deleteMode: DeleteMode;
  onDeleteModeChange: (m: DeleteMode) => void;
  onDeleteStart: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  isPendingUpdate: boolean;
  isPendingDelete: boolean;
}

function CollectionRow({
  collection,
  isEditing,
  editName,
  editDesc,
  onEditNameChange,
  onEditDescChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  isDeleting,
  deleteMode,
  onDeleteModeChange,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
  isPendingUpdate,
  isPendingDelete,
}: CollectionRowProps) {
  return (
    <div className="border-b border-obsidian-border/10 last:border-b-0">
      {isEditing ? (
        <div className="px-4 py-3 space-y-2 bg-obsidian-sunken/20">
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            aria-label="Collection name"
            className="input-cmd w-full text-[10px]"
            autoFocus
          />
          <input
            type="text"
            value={editDesc}
            onChange={(e) => onEditDescChange(e.target.value)}
            placeholder="DESCRIPTION (OPTIONAL)..."
            aria-label="Collection description"
            className="input-cmd w-full text-[10px]"
          />
          <div className="flex gap-2">
            <button
              onClick={onEditSave}
              disabled={!editName.trim() || isPendingUpdate}
              className="flex items-center gap-1.5 font-mono text-[9px] text-phosphor uppercase tracking-wider px-3 py-1.5 bg-phosphor/10 hover:bg-phosphor/20 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={9} strokeWidth={2} />
              {isPendingUpdate ? 'SAVING...' : 'SAVE_'}
            </button>
            <button
              onClick={onEditCancel}
              className="font-mono text-[9px] text-ui-dim uppercase tracking-wider px-3 py-1.5 hover:text-ui-muted transition-colors duration-100"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : isDeleting ? (
        <div className="px-4 py-3 bg-red-950/20 space-y-2">
          <p className="font-mono text-[9px] text-red-400 uppercase tracking-wider">
            DELETE &ldquo;{collection.name}&rdquo; — CHOOSE MODE:
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onDeleteModeChange('reassign')}
              aria-pressed={deleteMode === 'reassign'}
              className={`font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border transition-colors duration-100 ${
                deleteMode === 'reassign'
                  ? 'border-ui-muted text-ui-text bg-obsidian-raised/50'
                  : 'border-obsidian-border/30 text-ui-dim hover:border-obsidian-border hover:text-ui-muted'
              }`}
            >
              REASSIGN_SOURCES
            </button>
            <button
              onClick={() => onDeleteModeChange('cascade')}
              aria-pressed={deleteMode === 'cascade'}
              className={`font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border transition-colors duration-100 ${
                deleteMode === 'cascade'
                  ? 'border-red-500/60 text-red-300 bg-red-950/30'
                  : 'border-obsidian-border/30 text-ui-dim hover:border-red-500/40 hover:text-red-400'
              }`}
            >
              CASCADE_DELETE
            </button>
          </div>
          <p className="font-mono text-[8px] text-ui-dim uppercase tracking-wider">
            {deleteMode === 'reassign'
              ? 'SOURCES WILL BE MOVED TO DEFAULT COLLECTION'
              : 'ALL SOURCES AND CHUNKS WILL BE PERMANENTLY DELETED'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onDeleteConfirm}
              disabled={isPendingDelete}
              className="font-mono text-[9px] text-red-400 uppercase tracking-wider px-3 py-1.5 bg-red-950/30 border border-red-500/30 hover:bg-red-950/50 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPendingDelete ? 'DELETING...' : 'CONFIRM_DELETE_'}
            </button>
            <button
              onClick={onDeleteCancel}
              className="font-mono text-[9px] text-ui-dim uppercase tracking-wider px-3 py-1.5 hover:text-ui-muted transition-colors duration-100"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <div className="group flex items-center gap-3 px-4 py-3 hover:bg-obsidian-sunken/20 transition-colors duration-100">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] text-ui-text uppercase tracking-wider truncate block">
              {collection.name}
            </span>
            {collection.description && (
              <p className="font-mono text-[9px] text-ui-dim uppercase tracking-wider mt-0.5 truncate">
                {collection.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100 shrink-0">
            <button
              onClick={onEditStart}
              aria-label={`Edit collection ${collection.name}`}
              className="p-1.5 text-ui-dim hover:text-ui-text transition-colors duration-100"
            >
              <Pencil size={10} strokeWidth={1.5} />
            </button>
            <button
              onClick={onDeleteStart}
              aria-label={`Delete collection ${collection.name}`}
              className="p-1.5 text-ui-dim hover:text-red-400 transition-colors duration-100"
            >
              <Trash2 size={10} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
