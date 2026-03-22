import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreateCollectionInput, UpdateCollectionInput, DeleteCollectionMode } from '../api/client';

export const COLLECTIONS_QUERY_KEY = ['collections'] as const;

export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: () => api.listCollections(),
    staleTime: 60_000,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) => api.createCollection(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCollectionInput }) =>
      api.updateCollection(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: DeleteCollectionMode }) =>
      api.deleteCollection(id, mode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}
