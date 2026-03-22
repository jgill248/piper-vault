import { z } from 'zod';

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  collectionId: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>;
