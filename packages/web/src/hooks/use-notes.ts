import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useNotes(params?: {
  page?: number;
  pageSize?: number;
  collectionId?: string;
  parentPath?: string;
  search?: string;
  tag?: string;
}) {
  return useQuery({
    queryKey: ['notes', params],
    queryFn: () => api.listNotes(params),
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ['note', id],
    queryFn: () => api.getNote(id!),
    enabled: id !== undefined,
  });
}

export function useBacklinks(id: string | undefined) {
  return useQuery({
    queryKey: ['backlinks', id],
    queryFn: () => api.getBacklinks(id!),
    enabled: id !== undefined,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      content: string;
      collectionId?: string;
      parentPath?: string | null;
      tags?: string[];
    }) => api.createNote(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      content?: string;
      title?: string;
      parentPath?: string | null;
      tags?: string[];
    }) => api.updateNote(id, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      void queryClient.invalidateQueries({ queryKey: ['note', variables.id] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
