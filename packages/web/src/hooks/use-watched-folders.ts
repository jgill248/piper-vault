import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreateWatchedFolderInput } from '../api/client';

export const WATCHED_FOLDERS_QUERY_KEY = ['watched-folders'] as const;

export function useWatchedFolders(collectionId?: string) {
  return useQuery({
    queryKey: [...WATCHED_FOLDERS_QUERY_KEY, collectionId],
    queryFn: () => api.listWatchedFolders(collectionId),
  });
}

export function useAddWatchedFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWatchedFolderInput) => api.addWatchedFolder(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WATCHED_FOLDERS_QUERY_KEY });
    },
  });
}

export function useRemoveWatchedFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeWatchedFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WATCHED_FOLDERS_QUERY_KEY });
    },
  });
}

export function useScanWatchedFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scanWatchedFolder(id),
    onSuccess: () => {
      // Invalidate watched folders to update lastScanAt and sources
      void queryClient.invalidateQueries({ queryKey: WATCHED_FOLDERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
