import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { UploadSourceBody } from '../api/client';

export function useListSources(page = 1, pageSize = 20, collectionId?: string) {
  return useQuery({
    queryKey: ['sources', page, pageSize, collectionId],
    queryFn: () => api.listSources(page, pageSize, collectionId),
  });
}

export function useUploadSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UploadSourceBody) => api.uploadSource(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSource(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useReindexSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.reindexSource(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useListTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.listTags(),
  });
}

export function useUpdateSourceTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => api.updateSourceTags(id, tags),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useBulkImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      directoryPath,
      tags,
      collectionId,
    }: {
      directoryPath: string;
      tags?: string[];
      collectionId?: string;
    }) => api.bulkImport(directoryPath, tags, collectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
