import { SetMetadata } from '@nestjs/common';

export const IS_SKIP_LICENSE_KEY = 'isSkipLicense';

/**
 * Mark a controller or route handler as exempt from the license check.
 * When applied, the LicenseGuard will skip license validation for this endpoint.
 */
export const SkipLicense = () => SetMetadata(IS_SKIP_LICENSE_KEY, true);
