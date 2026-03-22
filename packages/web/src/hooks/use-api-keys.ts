import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreateApiKeyInput } from '../api/client';

export const API_KEYS_QUERY_KEY = ['api-keys'] as const;

export function useApiKeys(collectionId?: string) {
  return useQuery({
    queryKey: [...API_KEYS_QUERY_KEY, collectionId],
    queryFn: () => api.listApiKeys(collectionId),
    staleTime: 30_000,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => api.createApiKey(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}
