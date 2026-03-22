import { z } from 'zod';

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateCollectionDto = z.infer<typeof CreateCollectionSchema>;

export const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateCollectionDto = z.infer<typeof UpdateCollectionSchema>;
