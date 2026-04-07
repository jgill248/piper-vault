import { z } from 'zod';
import { extname } from 'path';
import { FILE_EXTENSIONS } from '@delve/shared';

/**
 * Detects MIME type from a filename using the shared FILE_EXTENSIONS map.
 * Falls back to 'text/plain' if the extension is unrecognised.
 */
export function detectMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return (FILE_EXTENSIONS[ext] as string | undefined) ?? 'text/plain';
}

export const WebhookIngestSchema = z.object({
  content: z.string().min(1).max(50_000_000),
  filename: z.string().min(1).max(500).refine(
    (f) => !f.includes('..') && !f.includes('/') && !f.includes('\\'),
    'Filename must not contain path separators or traversal sequences',
  ),
  fileType: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WebhookIngestDto = z.infer<typeof WebhookIngestSchema>;

export const WebhookIngestUrlSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(500).refine(
    (f) => !f.includes('..') && !f.includes('/') && !f.includes('\\'),
    'Filename must not contain path separators or traversal sequences',
  ).optional(),
  tags: z.array(z.string().min(1).max(50)).max(100).optional(),
});

export type WebhookIngestUrlDto = z.infer<typeof WebhookIngestUrlSchema>;
