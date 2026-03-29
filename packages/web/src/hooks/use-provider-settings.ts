import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LlmProviderName } from '@delve/shared';
import { api } from '../api/client';

export function useProviderSettings() {
  return useQuery({
    queryKey: ['provider-settings'],
    queryFn: () => api.getProviderSettings(),
  });
}

export function useUpdateProviderSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      settings,
    }: {
      provider: LlmProviderName;
      settings: { baseUrl?: string; apiKey?: string };
    }) => api.updateProviderSettings(provider, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-settings'] });
    },
  });
}
