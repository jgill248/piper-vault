import { z } from 'zod';

export const ActivateLicenseDtoSchema = z.object({
  licenseKey: z
    .string()
    .min(1, 'License key is required')
    .max(512, 'License key is too long'),
});

export type ActivateLicenseDto = z.infer<typeof ActivateLicenseDtoSchema>;
