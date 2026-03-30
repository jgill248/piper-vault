export const API_PREFIX = '/api/v1';

export const SUPPORTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  'text/html',
] as const;

export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

export const FILE_EXTENSIONS: Record<string, SupportedFileType> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.html': 'text/html',
};

export const EMBEDDING_DIMENSIONS = 384;

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
