import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useGraph(collectionId?: string) {
  return useQuery({
    queryKey: ['graph', collectionId],
    queryFn: () => api.getGraph(collectionId),
    staleTime: 60_000,
  });
}
