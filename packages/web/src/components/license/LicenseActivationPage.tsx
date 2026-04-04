import { useState } from 'react';
import type { LicenseStatus } from '@delve/shared';
import { api } from '../../api/client';

interface LicenseActivationPageProps {
  status: LicenseStatus;
  onActivated: () => void;
}

/**
 * Full-page license activation gate.
 * Shown when no valid license exists or the license has expired.
 * Follows the Sovereign Press design language (matches LoginPage).
 */
export function LicenseActivationPage({
  status,
  onActivated,
}: LicenseActivationPageProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.activateLicense({ licenseKey });
      onActivated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Activation failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const subtitle =
    status === 'expired'
      ? 'Your license has expired. Please re-activate to continue.'
      : 'Enter your license key to activate this instance.';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="font-label text-[10px] text-primary uppercase tracking-[0.3em] mb-1">
            P.I.P.E.R. Vault
          </div>
          <h1 className="font-headline text-xl text-on-surface uppercase tracking-wider">
            License Activation
          </h1>
          <div className="mt-2 font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            {subtitle}
          </div>
        </div>

        {/* Form card */}
        <div className="relative border border-outline-variant bg-surface-container-low p-6">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-px bg-primary opacity-60" />

          <form onSubmit={handleSubmit} noValidate>
            {/* License key field */}
            <div className="mb-5">
              <label
                htmlFor="license-key"
                className="block font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-1.5"
              >
                License Key
              </label>
              <input
                id="license-key"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="input-cmd disabled:opacity-50"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline)';
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                className="mb-4 px-3 py-2 font-label text-[10px] border text-error border-error bg-error-container/10"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !licenseKey.trim()}
              className="btn-primary w-full py-2.5 disabled:opacity-40"
            >
              {isSubmitting ? 'Activating...' : 'Activate License'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            Need a license?{' '}
          </span>
          <a
            href="https://delve.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[9px] text-primary uppercase tracking-widest"
          >
            Get one here
          </a>
        </div>
      </div>
    </div>
  );
}
