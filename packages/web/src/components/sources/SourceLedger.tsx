import { Trash2, FileText } from 'lucide-react';
import type { Source } from '@delve/shared';
import { SOURCE_STATUS } from '@delve/shared';
import { useDeleteSource } from '../../hooks/use-sources';

interface SourceLedgerProps {
  sources: readonly Source[];
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

const COLUMNS = ['FILENAME', 'TYPE', 'SIZE', 'STATUS', 'CHUNKS', 'ACTIONS'];

export function SourceLedger({ sources }: SourceLedgerProps) {
  const deleteSource = useDeleteSource();

  function handleDelete(id: string, filename: string) {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    deleteSource.mutate(id);
  }

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
          {sources.map((source) => (
            <tr
              key={source.id}
              className="border-b border-obsidian-border/10 hover:bg-obsidian-raised/30 transition-colors duration-75 group"
            >
              {/* Filename */}
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText size={11} className="text-ui-dim shrink-0" strokeWidth={1.5} />
                  <span
                    className="font-mono text-[11px] text-ui-text truncate max-w-[220px]"
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

              {/* Actions */}
              <td className="px-3 py-2">
                <button
                  onClick={() => handleDelete(source.id, source.filename)}
                  disabled={deleteSource.isPending}
                  aria-label={`Delete ${source.filename}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-ui-dim hover:text-red-400 disabled:cursor-not-allowed p-1"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
