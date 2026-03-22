import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/**
 * Checks whether JWT-based user authentication is enabled on this Delve instance.
 * The backend exposes this as `authEnabled` on the GET /api/v1/config response.
 *
 * When auth is disabled (the default), the UI skips all login/register flows.
 */
export function useAuthConfig(): {
  authEnabled: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['config', 'auth-enabled'],
    queryFn: () => api.getConfig(),
    // Retry once — if the server is unreachable treat auth as disabled
    retry: 1,
    // Config changes rarely; 5 min stale time
    staleTime: 5 * 60 * 1000,
  });

  return {
    authEnabled: data?.authEnabled ?? false,
    isLoading,
  };
}
