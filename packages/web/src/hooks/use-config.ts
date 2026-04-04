import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppConfig } from '@delve/shared';
import { api } from '../api/client';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.getConfig(),
  });
}

export function useModels(provider?: string) {
  return useQuery({
    queryKey: ['models', provider ?? ''],
    queryFn: () => api.getModels(provider),
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AppConfig>) => api.updateConfig(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['config'], updated);
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}
