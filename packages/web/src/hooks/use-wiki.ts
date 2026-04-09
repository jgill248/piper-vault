import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useWikiIndex(collectionId?: string) {
  return useQuery({
    queryKey: ['wiki', 'index', collectionId],
    queryFn: () => api.getWikiIndex(collectionId),
  });
}

export function useWikiLog(params?: { limit?: number; offset?: number; operation?: string }) {
  return useQuery({
    queryKey: ['wiki', 'log', params],
    queryFn: () => api.getWikiLog(params),
  });
}

export function useRunWikiLint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { collectionId?: string }) => api.runWikiLint(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] });
    },
  });
}

export function usePromoteToWiki() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; messageId?: string; collectionId?: string }) =>
      api.promoteToWiki(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] });
    },
  });
}
