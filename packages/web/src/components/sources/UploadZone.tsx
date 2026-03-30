import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { FILE_EXTENSIONS, MAX_FILE_SIZE } from '@delve/shared';
import { useUploadSource } from '../../hooks/use-sources';
import { useActiveCollection } from '../../context/CollectionContext';

const ACCEPTED_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx', '.csv', '.tsv', '.json', '.html'];
const ACCEPTED_MIME = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  'text/html',
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME.includes(file.type)) return true;
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface UploadStatus {
  filename: string;
  fileSize: number;
  state: 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSource = useUploadSource();
  const { activeCollectionId } = useActiveCollection();

  async function processFiles(files: File[]) {
    const accepted = files.filter(isAcceptedFile);
    if (accepted.length === 0) return;

    for (const file of accepted) {
      setUploads((prev) => [
        ...prev,
        { filename: file.name, fileSize: file.size, state: 'uploading' },
      ]);

      try {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File exceeds ${formatBytes(MAX_FILE_SIZE)} limit`);
        }
        const content = await readFileAsBase64(file);
        const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
        const mimeType = FILE_EXTENSIONS[ext] ?? (file.type || 'text/plain');

        await uploadSource.mutateAsync({ filename: file.name, content, mimeType, collectionId: activeCollectionId });

        setUploads((prev) =>
          prev.map((u) => (u.filename === file.name ? { ...u, state: 'done' } : u)),
        );

        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.filename !== file.name));
        }, 3000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setUploads((prev) =>
          prev.map((u) => (u.filename === file.name ? { ...u, state: 'error', error: msg } : u)),
        );
      }
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      await processFiles(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    await processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDrop={(e) => void handleDrop(e)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files by clicking or dragging"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        className={`
          relative flex flex-col items-center justify-center gap-3 py-8 px-4 cursor-pointer
          border-2 border-dashed transition-all duration-150
          ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-outline-variant/40 hover:border-outline-variant hover:bg-surface/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.pdf,.docx,.csv,.tsv,.json,.html"
          multiple
          onChange={(e) => void handleFileInput(e)}
          className="sr-only"
          aria-hidden="true"
        />

        <Upload
          size={24}
          strokeWidth={1.5}
          className={isDragOver ? 'text-primary' : 'text-on-surface-variant'}
        />
        <div className="text-center space-y-1">
          <p className="font-label text-xs text-secondary uppercase tracking-wider">
            {isDragOver ? 'RELEASE TO UPLOAD' : 'DROP FILES / CLICK TO BROWSE'}
          </p>
          <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            ACCEPTED: .MD · .TXT · .PDF · .DOCX · .CSV · .TSV · .JSON · .HTML
          </p>
        </div>
      </div>

      {/* Upload status list */}
      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((u) => (
            <div
              key={u.filename}
              className="flex items-center gap-3 px-3 py-2 bg-surface border border-outline-variant/20"
            >
              <FileText size={12} className="text-on-surface-variant shrink-0" />
              <span className="font-label text-[10px] text-secondary flex-1 truncate">
                {u.filename}
              </span>
              <span className="font-label text-[9px] text-on-surface-variant tabular-nums shrink-0">
                {formatBytes(u.fileSize)}
              </span>
              {u.state === 'uploading' && (
                <span className="flex items-center gap-1 font-label text-[9px] text-blue-400 uppercase tracking-wider shrink-0">
                  <Loader2 size={10} className="animate-spin" />
                  UPLOADING
                </span>
              )}
              {u.state === 'done' && (
                <span className="font-label text-[9px] text-primary uppercase tracking-wider shrink-0">
                  INGESTED
                </span>
              )}
              {u.state === 'error' && (
                <span
                  className="font-label text-[9px] text-red-400 uppercase tracking-wider shrink-0"
                  title={u.error}
                >
                  ERROR
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
