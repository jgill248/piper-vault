import { useListSources } from './use-sources';

/**
 * Detects whether the vault is empty (no sources ingested).
 * Used for first-run onboarding — show vault-building guidance instead of blank panels.
 */
export function useVaultStatus() {
  const { data, isLoading } = useListSources(1, 1);
  const isEmpty = data !== undefined && data.total === 0;

  return { isEmpty, isLoading };
}
