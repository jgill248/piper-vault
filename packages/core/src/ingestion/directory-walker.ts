import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { FILE_EXTENSIONS } from '@delve/shared';

export interface WalkedFile {
  readonly path: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly fileSize: number;
}

/**
 * Recursively walks a directory and returns all files with supported extensions.
 */
export function walkDirectory(dirPath: string): WalkedFile[] {
  const results: WalkedFile[] = [];

  function walk(currentPath: string): void {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip symlinks to prevent symlink traversal attacks (CWE-59)
      if (entry.isSymbolicLink()) {
        continue;
      }

      const fullPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        const mimeType = FILE_EXTENSIONS[ext];
        if (mimeType) {
          const stat = statSync(fullPath);
          results.push({
            path: fullPath,
            filename: entry.name,
            mimeType,
            fileSize: stat.size,
          });
        }
      }
    }
  }

  walk(dirPath);
  return results;
}
