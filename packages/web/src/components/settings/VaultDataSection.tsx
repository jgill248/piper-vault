import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

/**
 * Settings section for vault portability: download the full vault as a JSON
 * file, or restore one previously exported. Implements the "your data is
 * yours" promise — users can leave this deployment without manual re-ingest.
 */
export function VaultDataSection() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const blob = await api.exportVault();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `piper-vault-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.addToast('Vault exported', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Export failed';
      toast.addToast(message, 'error');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await api.importVault(payload);
      const parts: string[] = [];
      for (const [key, count] of Object.entries(result.imported)) {
        if (count > 0) parts.push(`${count} ${key}`);
      }
      toast.addToast(
        `Imported: ${parts.length > 0 ? parts.join(', ') : 'nothing new'}${
          result.reprocessRecommended ? '. Re-ingest sources to regenerate search index.' : ''
        }`,
        'success',
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed';
      toast.addToast(message, 'error');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="mb-6" id="section-vault-data">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
          VAULT_DATA
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      <div className="bg-surface-container border border-outline-variant/20 px-3">
        <div className="flex items-start justify-between py-2.5 border-b border-outline-variant/10 gap-4">
          <div className="flex-1 min-w-0">
            <label className="font-label text-[10px] text-secondary uppercase tracking-widest block">
              EXPORT_VAULT
            </label>
            <p className="font-body text-[10px] text-on-surface-variant mt-0.5 leading-relaxed">
              Download every note, source, wiki page, conversation and preset as a single JSON file. Chunks and embeddings are omitted — they regenerate on the destination.
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            <button
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Export the full vault as a JSON download"
              className="btn-secondary text-[10px] px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExporting ? 'EXPORTING...' : 'DOWNLOAD_JSON'}
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between py-2.5 gap-4">
          <div className="flex-1 min-w-0">
            <label className="font-label text-[10px] text-secondary uppercase tracking-widest block">
              IMPORT_VAULT
            </label>
            <p className="font-body text-[10px] text-on-surface-variant mt-0.5 leading-relaxed">
              Restore from a previously exported JSON file. Records are upserted by ID — importing the same file twice is a no-op. After import, reprocess sources to rebuild the search index.
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
              className="hidden"
              aria-hidden="true"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              aria-label="Import a previously exported vault JSON file"
              className="btn-secondary text-[10px] px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isImporting ? 'IMPORTING...' : 'UPLOAD_JSON'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
