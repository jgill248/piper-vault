import { useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useListSources } from '../../hooks/use-sources';
import { UploadZone } from './UploadZone';
import { SourceLedger } from './SourceLedger';

export function SourcesPanel() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError, error, refetch, isFetching } = useListSources(page, PAGE_SIZE);

  const sources = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

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

        {/* Ledger section */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[9px] text-phosphor uppercase tracking-widest">
              02
            </span>
            <span className="font-mono text-[10px] text-ui-muted uppercase tracking-wider">
              SOURCE_LEDGER
            </span>
            <div className="flex-1 h-px bg-obsidian-border/20" />
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
              <SourceLedger sources={sources} />
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
