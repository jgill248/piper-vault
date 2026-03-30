import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreatePresetInput, UpdatePresetInput } from '@delve/shared';

export const PRESETS_QUERY_KEY = ['presets'] as const;

export function usePresets() {
  return useQuery({
    queryKey: PRESETS_QUERY_KEY,
    queryFn: () => api.listPresets(),
    staleTime: 60_000,
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePresetInput) => api.createPreset(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRESETS_QUERY_KEY });
    },
  });
}

export function useUpdatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePresetInput }) =>
      api.updatePreset(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRESETS_QUERY_KEY });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRESETS_QUERY_KEY });
    },
  });
}
