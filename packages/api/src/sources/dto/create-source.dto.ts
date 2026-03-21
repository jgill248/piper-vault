import { z } from 'zod';
import { SUPPORTED_FILE_TYPES } from '@delve/shared';
import { MAX_FILE_SIZE } from '@delve/shared';

/**
 * Request body for POST /api/v1/sources/upload.
 *
 * For Phase 1 we accept a base64-encoded file body rather than multipart
 * to keep the upload path simple. Multipart support will be added in Phase 2.
 */
export const CreateSourceSchema = z.object({
  filename: z.string().min(1).max(500),
  content: z.string().min(1), // base64-encoded file bytes
  mimeType: z.string().refine(
    (v): v is (typeof SUPPORTED_FILE_TYPES)[number] =>
      (SUPPORTED_FILE_TYPES as readonly string[]).includes(v),
    {
      message: `mimeType must be one of: ${SUPPORTED_FILE_TYPES.join(', ')}`,
    },
  ),
});

export type CreateSourceDto = z.infer<typeof CreateSourceSchema>;

/**
 * Decodes the base64 content field and validates that the resulting buffer
 * does not exceed MAX_FILE_SIZE. Returns the buffer or throws a ZodError.
 */
export function decodeSourceBuffer(dto: CreateSourceDto): Buffer {
  const buffer = Buffer.from(dto.content, 'base64');
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${buffer.byteLength} bytes exceeds the maximum of ${MAX_FILE_SIZE} bytes`,
    );
  }
  return buffer;
}
