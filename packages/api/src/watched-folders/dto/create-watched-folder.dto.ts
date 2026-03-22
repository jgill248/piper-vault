import { z } from 'zod';

export const CreateWatchedFolderSchema = z.object({
  collectionId: z.string().uuid(),
  folderPath: z.string().min(1),
  recursive: z.boolean().optional().default(true),
});

export type CreateWatchedFolderDto = z.infer<typeof CreateWatchedFolderSchema>;
