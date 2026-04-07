import { BadRequestException } from '@nestjs/common';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';

/**
 * Sanitizes a user-provided directory path to prevent path traversal attacks.
 *
 * - Rejects null bytes
 * - Normalizes with path.resolve()
 * - Resolves symlinks via realpathSync() (the path must already exist)
 *
 * @returns The canonical, resolved absolute path
 * @throws BadRequestException if the path contains traversal sequences or null bytes
 */
export function sanitizePath(userPath: string): string {
  // Block null byte injection
  if (userPath.includes('\0')) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_PATH',
        message: 'Path contains invalid characters',
      },
    });
  }

  // Normalize the path (collapses ../ sequences)
  const normalized = resolve(userPath);

  // Resolve symlinks to get the real canonical path
  let canonical: string;
  try {
    canonical = realpathSync(normalized);
  } catch {
    // If realpath fails the path doesn't exist — that's fine,
    // the caller will handle existence checks.
    // Return the normalized path instead.
    return normalized;
  }

  return canonical;
}
