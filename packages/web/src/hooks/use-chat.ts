import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatRequest } from '@delve/shared';
import { api } from '../api/client';

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChatRequest) => api.sendMessage(body),
    onSuccess: (data) => {
      // Invalidate both the conversation list and the specific active conversation
      // so React Query refetches the latest messages after the backend persists them.
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({
        queryKey: ['conversation', data.conversationId],
      });
    },
  });
}

export function useConversations(collectionId?: string) {
  return useQuery({
    queryKey: ['conversations', collectionId],
    queryFn: () => api.listConversations(collectionId),
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.getConversation(id!),
    enabled: !!id,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useExportConversation() {
  return useMutation({
    mutationFn: (id: string) => api.exportConversation(id),
  });
}
