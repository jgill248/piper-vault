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

export function useInitializeWiki() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { collectionId?: string }) => api.initializeWiki(body),
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

export function useRegenerateWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { pageId: string; preview?: boolean }) =>
      api.regenerateWikiPage(body),
    onSuccess: (_data, variables) => {
      if (!variables.preview) {
        queryClient.invalidateQueries({ queryKey: ['wiki'] });
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
    },
  });
}
