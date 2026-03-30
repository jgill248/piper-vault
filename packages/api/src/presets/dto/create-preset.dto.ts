import { z } from 'zod';

export const CreatePresetSchema = z.object({
  name: z.string().min(1).max(200),
  persona: z.string().default(''),
  model: z.string().min(1).max(100).optional(),
});

export type CreatePresetDto = z.infer<typeof CreatePresetSchema>;

export const UpdatePresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  persona: z.string().optional(),
  model: z.string().min(1).max(100).nullish(),
});

export type UpdatePresetDto = z.infer<typeof UpdatePresetSchema>;
