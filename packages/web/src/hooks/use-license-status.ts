import { useQuery } from '@tanstack/react-query';
import type { LicenseInfo } from '@delve/shared';
import { api } from '../api/client';

/**
 * Checks the license status of this Delve instance.
 * Returns 'valid', 'expired', 'missing', or 'invalid'.
 *
 * When the license is not valid, the UI shows the activation page.
 */
export function useLicenseStatus(): {
  license: LicenseInfo | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['license', 'status'],
    queryFn: () => api.getLicenseStatus(),
    retry: 1,
    staleTime: 60_000,
  });

  return {
    license: data ?? null,
    isLoading,
    refetch,
  };
}
