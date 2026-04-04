export type LicensePlan = 'weekly' | 'monthly' | 'yearly';

export type LicenseStatus = 'valid' | 'expired' | 'missing' | 'invalid';

export interface LicenseInfo {
  readonly status: LicenseStatus;
  readonly plan?: LicensePlan;
  readonly expiresAt?: string;
  readonly features?: Readonly<Record<string, boolean>>;
}

export interface ActivateLicenseInput {
  readonly licenseKey: string;
}

export interface ActivateLicenseResponse {
  readonly status: 'activated';
  readonly plan: LicensePlan;
  readonly expiresAt: string;
}
