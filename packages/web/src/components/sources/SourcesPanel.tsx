import { useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useListSources, useBulkImport } from '../../hooks/use-sources';
import { useActiveCollection } from '../../context/CollectionContext';
import { UploadZone } from './UploadZone';
import { SourceLedger } from './SourceLedger';
import type { SourceFilters } from './SourceLedger';

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: 'ALL TYPES' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'md', label: 'MD' },
  { value: 'txt', label: 'TXT' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'ALL STATUS' },
  { value: 'ready', label: 'READY' },
  { value: 'processing', label: 'PROCESSING' },
  { value: 'pending', label: 'PENDING' },
  { value: 'error', label: 'ERROR' },
];

export function SourcesPanel() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [bulkImportPath, setBulkImportPath] = useState('');
  const bulkImport = useBulkImport();
  const { activeCollectionId } = useActiveCollection();

  const [filters, setFilters] = useState<SourceFilters>({
    search: '',
    fileType: 'all',
    status: 'all',
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useListSources(page, PAGE_SIZE, activeCollectionId);

  const sources = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
    setPage(1);
  }

  function handleFileTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilters((prev) => ({ ...prev, fileType: e.target.value }));
    setPage(1);
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilters((prev) => ({ ...prev, status: e.target.value }));
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border/20 bg-obsidian-surface shrink-0">
        <div>
          <h1 className="font-display font-semibold text-ui-text text-sm">Knowledge Sources</h1>
          <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mt-0.5">
            {data ? `${data.total} SOURCES INDEXED` : 'LOADING...'}
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh sources"
          className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5"
        >
          <RefreshCw
            size={10}
            strokeWidth={2}
            className={isFetching ? 'animate-spin' : ''}
          />
          REFRESH_
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Upload section */}
        <div className="px-4 py-4 border-b border-obsidian-border/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[9px] text-phosphor uppercase tracking-widest">
              01
            </span>
            <span className="font-mono text-[10px] text-ui-muted uppercase tracking-wider">
              INGEST_NEW_SOURCE
            </span>
            <div className="flex-1 h-px bg-obsidian-border/20" />
          </div>
          <UploadZone />
        </div>

        {/* Bulk import section */}
        <div className="px-4 py-4 border-b border-obsidian-border/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[9px] text-phosphor uppercase tracking-widest">
              02
            </span>
            <span className="font-mono text-[10px] text-ui-muted uppercase tracking-wider">
              BULK_IMPORT
            </span>
            <div className="flex-1 h-px bg-obsidian-border/20" />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={bulkImportPath}
              onChange={(e) => setBulkImportPath(e.target.value)}
              placeholder="/PATH/TO/DIRECTORY..."
              aria-label="Directory path for bulk import"
              className="input-cmd flex-1"
            />
            <button
              onClick={() => {
                if (bulkImportPath.trim()) {
                  bulkImport.mutate({ directoryPath: bulkImportPath.trim(), collectionId: activeCollectionId });
                }
              }}
              disabled={!bulkImportPath.trim() || bulkImport.isPending}
              className="btn-primary text-[10px] px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
            >
              {bulkImport.isPending ? 'IMPORTING...' : 'IMPORT_'}
            </button>
          </div>
          {bulkImport.isSuccess && (
            <div className="mt-2 bg-phosphor/5 border border-phosphor/20 px-3 py-2">
              <p className="font-mono text-[10px] text-phosphor uppercase tracking-wider">
                {bulkImport.data.filesIngested} FILES INGESTED / {bulkImport.data.filesSkipped} SKIPPED / {bulkImport.data.filesFound} FOUND
              </p>
              {bulkImport.data.errors.length > 0 && (
                <div className="mt-1">
                  {bulkImport.data.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="font-mono text-[9px] text-yellow-400">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {bulkImport.isError && (
            <div className="mt-2 bg-red-950/30 border border-red-500/20 px-3 py-2">
              <p className="font-mono text-[10px] text-red-400 uppercase tracking-wider">
                ERROR: {bulkImport.error instanceof Error ? bulkImport.error.message : 'Import failed'}
              </p>
            </div>
          )}
        </div>

        {/* Ledger section */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[9px] text-phosphor uppercase tracking-widest">
              03
            </span>
            <span className="font-mono text-[10px] text-ui-muted uppercase tracking-wider">
              SOURCE_LEDGER
            </span>
            <div className="flex-1 h-px bg-obsidian-border/20" />
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-3 bg-obsidian-sunken border border-obsidian-border/20 px-3 py-2">
            <div className="flex-1 relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ui-dim pointer-events-none">
                /
              </span>
              <input
                type="text"
                value={filters.search}
                onChange={handleSearchChange}
                placeholder="FILTER BY FILENAME..."
                aria-label="Filter sources by filename"
                className="w-full bg-transparent font-mono text-[10px] text-ui-text placeholder:text-ui-dim outline-none pl-4 pr-2 py-0.5 uppercase tracking-wider"
              />
            </div>
            <div className="w-px h-4 bg-obsidian-border/30 shrink-0" />
            <select
              value={filters.fileType}
              onChange={handleFileTypeChange}
              aria-label="Filter by file type"
              className="bg-transparent font-mono text-[10px] text-ui-muted uppercase tracking-wider outline-none cursor-pointer border-0 appearance-none pr-1"
            >
              {FILE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-obsidian-raised text-ui-text">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="w-px h-4 bg-obsidian-border/30 shrink-0" />
            <select
              value={filters.status}
              onChange={handleStatusChange}
              aria-label="Filter by status"
              className="bg-transparent font-mono text-[10px] text-ui-muted uppercase tracking-wider outline-none cursor-pointer border-0 appearance-none pr-1"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-obsidian-raised text-ui-text">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[10px] text-ui-dim uppercase tracking-widest animate-pulse">
                LOADING...
              </span>
            </div>
          )}

          {isError && (
            <div className="px-3 py-2 bg-red-950/30 border border-red-500/20">
              <p className="font-mono text-[10px] text-red-400 uppercase tracking-wider">
                ERROR: {error instanceof Error ? error.message : 'Failed to load sources'}
              </p>
            </div>
          )}

          {!isLoading && !isError && (
            <div className="bg-obsidian-sunken border border-obsidian-border/20">
              <SourceLedger sources={sources} filters={filters} />
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-obsidian-border/20">
              <span className="font-mono text-[9px] text-ui-dim uppercase tracking-wider">
                PAGE {page} OF {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="btn-secondary p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="btn-secondary p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
