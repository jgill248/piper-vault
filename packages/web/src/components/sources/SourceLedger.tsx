import { useState } from 'react';
import { Trash2, FileText, RefreshCw } from 'lucide-react';
import type { Source } from '@delve/shared';
import { SOURCE_STATUS } from '@delve/shared';
import { useDeleteSource, useReindexSource } from '../../hooks/use-sources';

export interface SourceFilters {
  search: string;
  fileType: string;
  status: string;
}

interface SourceLedgerProps {
  sources: readonly Source[];
  filters: SourceFilters;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatFileType(mimeType: string): string {
  const map: Record<string, string> = {
    'text/plain': 'TXT',
    'text/markdown': 'MD',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/csv': 'CSV',
    'text/tab-separated-values': 'TSV',
    'application/json': 'JSON',
    'text/html': 'HTML',
  };
  return map[mimeType] ?? mimeType.split('/')[1]?.toUpperCase() ?? 'UNK';
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function StatusChip({ status }: { status: Source['status'] }) {
  switch (status) {
    case SOURCE_STATUS.PENDING:
      return <span className="status-pending">{status}</span>;
    case SOURCE_STATUS.PROCESSING:
      return <span className="status-processing">{status}</span>;
    case SOURCE_STATUS.READY:
      return <span className="status-ready">{status}</span>;
    case SOURCE_STATUS.ERROR:
      return <span className="status-error">{status}</span>;
    default:
      return <span className="font-mono text-xs text-ui-dim uppercase">{status}</span>;
  }
}

function matchesFileType(source: Source, fileType: string): boolean {
  if (fileType === 'all') return true;
  return formatFileType(source.fileType) === fileType.toUpperCase();
}

function matchesStatus(source: Source, status: string): boolean {
  if (status === 'all') return true;
  return source.status.toLowerCase() === status.toLowerCase();
}

function matchesSearch(source: Source, search: string): boolean {
  if (!search) return true;
  return source.filename.toLowerCase().includes(search.toLowerCase());
}

interface SourceRowProps {
  source: Source;
}

function SourceRow({ source }: SourceRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteSource = useDeleteSource();
  const reindexSource = useReindexSource();

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteSource.mutate(source.id, {
      onSettled: () => setConfirmDelete(false),
    });
  }

  function handleReindex() {
    reindexSource.mutate(source.id);
  }

  return (
    <tr className="border-b border-obsidian-border/10 hover:bg-obsidian-raised/30 transition-colors duration-75 group">
      {/* Filename */}
      <td className="px-3 py-2" style={{ minWidth: '200px' }}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={11} className="text-ui-dim shrink-0" strokeWidth={1.5} />
          <span
            className="font-mono text-[11px] text-ui-text truncate"
            title={source.filename}
          >
            {source.filename}
          </span>
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-2">
        <span className="font-mono text-[10px] text-ui-muted">
          {formatFileType(source.fileType)}
        </span>
      </td>

      {/* Size */}
      <td className="px-3 py-2">
        <span className="font-mono text-[10px] text-ui-muted tabular-nums">
          {formatBytes(source.fileSize)}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        <StatusChip status={source.status} />
      </td>

      {/* Chunks */}
      <td className="px-3 py-2">
        <span className="font-mono text-[10px] text-ui-muted tabular-nums">
          {source.chunkCount}
        </span>
      </td>

      {/* Tags */}
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {source.tags.map((tag) => (
            <span
              key={tag}
              className="font-mono text-[9px] text-phosphor bg-phosphor/10 border border-phosphor/20 px-1.5 py-0.5 uppercase tracking-wider"
            >
              {tag}
            </span>
          ))}
          {source.tags.length === 0 && (
            <span className="font-mono text-[9px] text-ui-dim">—</span>
          )}
        </div>
      </td>

      {/* Date */}
      <td className="px-3 py-2">
        <span className="font-mono text-[10px] text-ui-dim tabular-nums">
          {formatDate(source.createdAt)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
          <button
            onClick={handleReindex}
            disabled={reindexSource.isPending}
            aria-label={`Reindex ${source.filename}`}
            title="Reindex"
            className="text-ui-dim hover:text-phosphor disabled:cursor-not-allowed p-1 transition-colors duration-100"
          >
            <RefreshCw
              size={12}
              strokeWidth={1.5}
              className={reindexSource.isPending ? 'animate-spin' : ''}
            />
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="font-mono text-[9px] text-yellow-400 uppercase tracking-wider">
                CONFIRM?
              </span>
              <button
                onClick={handleDeleteClick}
                disabled={deleteSource.isPending}
                aria-label={`Confirm delete ${source.filename}`}
                className="font-mono text-[9px] text-red-400 hover:text-red-300 uppercase tracking-wider px-1 transition-colors duration-100 disabled:cursor-not-allowed"
              >
                YES
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                aria-label="Cancel delete"
                className="font-mono text-[9px] text-ui-muted hover:text-ui-text uppercase tracking-wider px-1 transition-colors duration-100"
              >
                NO
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              disabled={deleteSource.isPending}
              aria-label={`Delete ${source.filename}`}
              className="text-ui-dim hover:text-red-400 disabled:cursor-not-allowed p-1 transition-colors duration-100"
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

const COLUMNS = ['FILENAME', 'TYPE', 'SIZE', 'STATUS', 'CHUNKS', 'TAGS', 'CREATED', 'ACTIONS'];

export function SourceLedger({ sources, filters }: SourceLedgerProps) {
  const filtered = sources.filter(
    (s) =>
      matchesSearch(s, filters.search) &&
      matchesFileType(s, filters.fileType) &&
      matchesStatus(s, filters.status),
  );

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <FileText size={24} className="text-ui-dim/40" strokeWidth={1} />
        <p className="font-mono text-[10px] text-ui-dim uppercase tracking-wider">
          NO SOURCES INDEXED
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <FileText size={24} className="text-ui-dim/40" strokeWidth={1} />
        <p className="font-mono text-[10px] text-ui-dim uppercase tracking-wider">
          NO SOURCES MATCH FILTERS
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" role="table">
        <thead>
          <tr className="bg-obsidian-surface border-b border-obsidian-border/20">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-mono text-[9px] text-ui-dim uppercase tracking-widest whitespace-nowrap"
                scope="col"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((source) => (
            <SourceRow key={source.id} source={source} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
