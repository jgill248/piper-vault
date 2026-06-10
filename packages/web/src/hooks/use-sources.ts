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

export function useListTags(collectionId?: string) {
  return useQuery({
    queryKey: ['tags', collectionId],
    queryFn: () => api.listTags(collectionId),
  });
}

export function useRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { oldTag: string; newTag: string; collectionId?: string }) =>
      api.renameTag(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { tag: string; collectionId?: string }) => api.deleteTag(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
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
