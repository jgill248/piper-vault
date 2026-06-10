import { z } from 'zod';

/**
 * Control-character regex: covers C0 (0x00–0x1F) and DEL (0x7F).
 * These characters are invalid in filenames on all major operating systems.
 * eslint-disable-next-line no-control-regex is intentional — we need to match
 * literal control characters by code point range.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;

/**
 * Windows-reserved characters that are also unsafe in cross-platform filenames.
 * < > : " | ? *
 */
const WINDOWS_RESERVED_RE = /[<>:"|?*]/;

/**
 * Shared Zod refinement message used by both upload and webhook ingest paths.
 */
const FILENAME_VALIDATION_MESSAGE =
  'Filename must not contain path separators, traversal sequences, control characters, or reserved characters';

/**
 * Shared Zod schema for filenames.
 *
 * Rejects:
 *   - empty / too-long strings (min 1, max 500)
 *   - path-traversal sequences (..)
 *   - path separators (/ and \)
 *   - C0 control characters and DEL (\x00–\x1F, \x7F)
 *   - Windows-reserved characters (< > : " | ? *)
 *
 * Applied to BOTH POST /api/v1/sources/upload and POST /api/v1/webhooks/ingest
 * so both endpoints behave identically.
 */
export const FilenameSchema = z
  .string()
  .min(1, 'Filename must not be empty')
  .max(500, 'Filename must not exceed 500 characters')
  .refine(
    (f) =>
      !f.includes('..') &&
      !f.includes('/') &&
      !f.includes('\\') &&
      !CONTROL_CHAR_RE.test(f) &&
      !WINDOWS_RESERVED_RE.test(f),
    FILENAME_VALIDATION_MESSAGE,
  );
