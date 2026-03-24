import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useFolders(collectionId?: string) {
  return useQuery({
    queryKey: ['folders', collectionId],
    queryFn: () => api.listFolders(collectionId),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { path: string; collectionId?: string }) => api.createFolder(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newPath }: { id: string; newPath: string }) =>
      api.renameFolder(id, newPath),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteContents }: { id: string; deleteContents?: boolean }) =>
      api.deleteFolder(id, deleteContents),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
