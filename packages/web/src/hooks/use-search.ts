import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { SearchBody } from '../api/client';

export function useSearch() {
  return useMutation({
    mutationFn: (body: SearchBody) => api.search(body),
  });
}
