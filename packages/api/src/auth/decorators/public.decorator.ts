import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a controller or route handler as publicly accessible.
 * When applied, the JwtAuthGuard will skip authentication for this endpoint,
 * even when AUTH_ENABLED is true.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
