import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const PLUGINS_QUERY_KEY = ['plugins'] as const;

/**
 * Returns the list of currently loaded plugins from the server.
 * Refreshes automatically when the window regains focus.
 */
export function usePlugins() {
  return useQuery({
    queryKey: PLUGINS_QUERY_KEY,
    queryFn: () => api.listPlugins(),
  });
}

/**
 * Mutation that triggers a plugin reload on the server and invalidates the
 * plugins list query so the UI updates automatically.
 */
export function useReloadPlugins() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.reloadPlugins(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLUGINS_QUERY_KEY });
    },
  });
}
