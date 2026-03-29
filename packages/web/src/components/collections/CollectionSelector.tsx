import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Settings2, Layers } from 'lucide-react';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import { useCollections, useCreateCollection } from '../../hooks/use-collections';
import { useActiveCollection } from '../../context/CollectionContext';
import { ManageCollectionsDialog } from './ManageCollectionsDialog';

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ref, handler]);
}

export function CollectionSelector() {
  const { activeCollectionId, setActiveCollectionId } = useActiveCollection();
  const { data, isLoading } = useCollections();
  const createCollection = useCreateCollection();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(dropdownRef, () => {
    setDropdownOpen(false);
    setCreateOpen(false);
    setNewName('');
  });

  useEffect(() => {
    if (createOpen) {
      setTimeout(() => createInputRef.current?.focus(), 0);
    }
  }, [createOpen]);

  const collections = data?.data ?? [];
  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const displayName = activeCollection?.name ?? (isLoading ? 'LOADING...' : 'DEFAULT');

  function handleSelectCollection(id: string) {
    setActiveCollectionId(id);
    setDropdownOpen(false);
    setCreateOpen(false);
    setNewName('');
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || createCollection.isPending) return;
    createCollection.mutate(
      { name: trimmed },
      {
        onSuccess: (created) => {
          setActiveCollectionId(created.id);
          setDropdownOpen(false);
          setCreateOpen(false);
          setNewName('');
        },
      },
    );
  }

  function handleOpenCreate(e: React.MouseEvent) {
    e.stopPropagation();
    setCreateOpen(true);
    setDropdownOpen(true);
  }

  function handleOpenManage(e: React.MouseEvent) {
    e.stopPropagation();
    setManageOpen(true);
    setDropdownOpen(false);
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label="Select active collection"
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface-container hover:bg-surface-container-high/30 transition-colors duration-100 min-w-0"
          >
            <Layers size={10} className="text-primary shrink-0" strokeWidth={1.5} />
            <span className="font-label text-[9px] text-secondary uppercase tracking-wider truncate flex-1 text-left">
              {displayName}
            </span>
            <ChevronDown
              size={9}
              className={`text-on-surface-variant shrink-0 transition-transform duration-100 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            onClick={handleOpenCreate}
            aria-label="Create new collection"
            title="Create new collection"
            className="p-2 text-on-surface-variant hover:text-primary transition-colors duration-100"
          >
            <Plus size={10} strokeWidth={2} />
          </button>
          <button
            onClick={handleOpenManage}
            aria-label="Manage collections"
            title="Manage collections"
            className="p-2 text-on-surface-variant hover:text-secondary transition-colors duration-100"
          >
            <Settings2 size={10} strokeWidth={1.5} />
          </button>
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            role="listbox"
            aria-label="Collections"
            className="absolute left-0 right-0 top-full mt-0.5 z-50 bg-surface-container-high border border-outline-variant/30 overflow-hidden"
          >
            {/* Create form */}
            {createOpen && (
              <form
                onSubmit={handleCreateSubmit}
                className="border-b border-outline-variant/20 px-2 py-2"
              >
                <input
                  ref={createInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="COLLECTION NAME..."
                  aria-label="New collection name"
                  className="w-full bg-surface-container font-label text-[9px] text-on-surface placeholder:text-on-surface-variant uppercase tracking-wider px-2 py-1.5 outline-none border-b border-outline-variant focus:border-primary transition-colors duration-100"
                />
                <div className="flex gap-1 mt-1.5">
                  <button
                    type="submit"
                    disabled={!newName.trim() || createCollection.isPending}
                    className="flex-1 font-label text-[9px] text-primary uppercase tracking-wider px-2 py-1 bg-primary/10 hover:bg-primary/20 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {createCollection.isPending ? 'CREATING...' : 'CREATE_'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreateOpen(false); setNewName(''); }}
                    className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider px-2 py-1 hover:text-secondary transition-colors duration-100"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}

            {/* Collection list */}
            {isLoading ? (
              <div className="px-3 py-2">
                <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest animate-pulse">
                  LOADING...
                </span>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {/* Default collection */}
                <CollectionOption
                  id={DEFAULT_COLLECTION_ID}
                  name="Default"
                  isDefault
                  isActive={activeCollectionId === DEFAULT_COLLECTION_ID}
                  onSelect={handleSelectCollection}
                />
                {collections
                  .filter((c) => c.id !== DEFAULT_COLLECTION_ID)
                  .map((c) => (
                    <CollectionOption
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      isDefault={false}
                      isActive={c.id === activeCollectionId}
                      onSelect={handleSelectCollection}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {manageOpen && (
        <ManageCollectionsDialog
          onClose={() => setManageOpen(false)}
        />
      )}
    </>
  );
}

interface CollectionOptionProps {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function CollectionOption({ id, name, isDefault, isActive, onSelect }: CollectionOptionProps) {
  return (
    <button
      role="option"
      aria-selected={isActive}
      onClick={() => onSelect(id)}
      className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors duration-100 ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-secondary hover:bg-surface-container-high/50 hover:text-on-surface'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 shrink-0 ${isActive ? 'bg-primary' : 'bg-outline-variant/50'}`}
        aria-hidden="true"
      />
      <span className="font-label text-[9px] uppercase tracking-wider truncate flex-1">{name}</span>
      {isDefault && (
        <span className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider shrink-0">
          DEFAULT
        </span>
      )}
    </button>
  );
}
