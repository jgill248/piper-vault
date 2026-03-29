import { useState } from 'react';
import { useWatchedFolders, useAddWatchedFolder, useRemoveWatchedFolder, useScanWatchedFolder } from '../../hooks/use-watched-folders';
import { useCollections } from '../../hooks/use-collections';
import type { WatchedFolder } from '../../api/client';

interface WatchedFolderRowProps {
  folder: WatchedFolder;
  collectionName: string;
  onRemove: (id: string) => void;
  onScan: (id: string) => void;
  isRemoving: boolean;
  isScanning: boolean;
}

function WatchedFolderRow({
  folder,
  collectionName,
  onRemove,
  onScan,
  isRemoving,
  isScanning,
}: WatchedFolderRowProps) {
  const lastScan = folder.lastScanAt
    ? new Date(folder.lastScanAt).toLocaleString()
    : 'NEVER';

  return (
    <div className="flex items-start justify-between py-2.5 border-b border-outline-variant/10 last:border-0 gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-label text-[11px] text-primary truncate" title={folder.folderPath}>
          {folder.folderPath}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            {collectionName}
          </span>
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            {folder.recursive ? 'RECURSIVE' : 'NON_RECURSIVE'}
          </span>
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            LAST_SCAN: {lastScan}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onScan(folder.id)}
          disabled={isScanning}
          aria-label={`Scan folder ${folder.folderPath}`}
          className="font-label text-[9px] text-secondary uppercase tracking-widest border border-outline-variant/30 px-2 py-1 hover:border-primary hover:text-primary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isScanning ? 'SCANNING...' : 'SCAN_NOW'}
        </button>
        <button
          onClick={() => onRemove(folder.id)}
          disabled={isRemoving}
          aria-label={`Remove watched folder ${folder.folderPath}`}
          className="font-label text-[9px] text-red-400 uppercase tracking-widest border border-red-400/30 px-2 py-1 hover:border-red-400 hover:bg-red-400/5 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRemoving ? 'REMOVING...' : 'REMOVE'}
        </button>
      </div>
    </div>
  );
}

export function WatchedFoldersSection() {
  const { data: folders = [], isLoading } = useWatchedFolders();
  const { data: collectionsData } = useCollections();
  const addFolder = useAddWatchedFolder();
  const removeFolder = useRemoveWatchedFolder();
  const scanFolder = useScanWatchedFolder();

  const collections = collectionsData?.data ?? [];

  const [folderPath, setFolderPath] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    collections[0]?.id ?? '00000000-0000-0000-0000-000000000000',
  );
  const [recursive, setRecursive] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Record<string, string>>({});

  const collectionMap = Object.fromEntries(
    collections.map((c) => [c.id, c.name]),
  );

  function handleAdd() {
    if (!folderPath.trim()) {
      setAddError('Folder path is required');
      return;
    }
    const collectionId = selectedCollectionId || collections[0]?.id || '00000000-0000-0000-0000-000000000000';
    setAddError(null);
    addFolder.mutate(
      { collectionId, folderPath: folderPath.trim(), recursive },
      {
        onSuccess: () => {
          setFolderPath('');
          setAddError(null);
        },
        onError: (err) => {
          setAddError(err instanceof Error ? err.message : 'Failed to add watched folder');
        },
      },
    );
  }

  function handleRemove(id: string) {
    removeFolder.mutate(id);
  }

  function handleScan(id: string) {
    scanFolder.mutate(id, {
      onSuccess: (result) => {
        setScanResults((prev) => ({
          ...prev,
          [id]: `${result.filesIngested} ingested, ${result.filesSkipped} skipped of ${result.filesFound} found`,
        }));
        setTimeout(() => {
          setScanResults((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 5000);
      },
      onError: (err) => {
        setScanResults((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : 'Scan failed',
        }));
      },
    });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3" id="section-folders">
        <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
          WATCHED_FOLDERS
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      <div className="bg-surface-container border border-outline-variant/20 px-3">
        {/* Add new watched folder */}
        <div className="py-3 border-b border-outline-variant/10">
          <label className="font-label text-[10px] text-secondary uppercase tracking-widest block mb-2">
            ADD_WATCHED_FOLDER
          </label>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="/path/to/folder"
              aria-label="Folder path"
              className="w-full bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors duration-100 placeholder:text-on-surface-variant"
            />
            <div className="flex items-center gap-3">
              {collections.length > 0 && (
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  aria-label="Collection"
                  className="flex-1 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-1 outline-none focus:border-primary transition-colors duration-100 appearance-none cursor-pointer"
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id} className="bg-surface-container-high text-on-surface">
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setRecursive((v) => !v)}
                aria-pressed={recursive}
                aria-label="Toggle recursive watching"
                className={`flex items-center gap-1.5 border px-2 py-1 font-label text-[9px] uppercase tracking-wider transition-all duration-150 ${
                  recursive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-outline-variant text-secondary hover:border-primary hover:text-primary'
                }`}
              >
                <span
                  className={`inline-block w-2.5 h-2.5 border shrink-0 transition-all duration-150 ${
                    recursive ? 'bg-primary border-primary' : 'bg-transparent border-outline-variant'
                  }`}
                  aria-hidden="true"
                />
                RECURSIVE
              </button>
              <button
                onClick={handleAdd}
                disabled={addFolder.isPending || !folderPath.trim()}
                aria-label="Add watched folder"
                className="btn-primary text-[9px] px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {addFolder.isPending ? 'ADDING...' : 'ADD_'}
              </button>
            </div>
            {addError && (
              <p className="font-label text-[9px] text-red-400 uppercase tracking-widest">
                {addError}
              </p>
            )}
          </div>
        </div>

        {/* Folder list */}
        {isLoading ? (
          <div className="py-4 text-center">
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
              LOADING...
            </span>
          </div>
        ) : folders.length === 0 ? (
          <div className="py-4 text-center">
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
              NO_WATCHED_FOLDERS
            </span>
          </div>
        ) : (
          <>
            {folders.map((folder) => (
              <div key={folder.id}>
                <WatchedFolderRow
                  folder={folder}
                  collectionName={collectionMap[folder.collectionId] ?? 'Unknown'}
                  onRemove={handleRemove}
                  onScan={handleScan}
                  isRemoving={removeFolder.isPending && removeFolder.variables === folder.id}
                  isScanning={scanFolder.isPending && scanFolder.variables === folder.id}
                />
                {scanResults[folder.id] !== undefined && (
                  <p className="font-label text-[9px] text-primary uppercase tracking-widest py-1">
                    SCAN_RESULT: {scanResults[folder.id]}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
