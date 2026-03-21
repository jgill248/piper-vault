import { API_PREFIX } from '@delve/shared';
import type {
  ChatRequest,
  ChatResponse,
  PaginatedResponse,
  Source,
  Conversation,
  ConversationWithMessages,
  AppConfig,
} from '@delve/shared';

export type { AppConfig };

const BASE_URL = API_PREFIX;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message ?? 'Request failed',
    );
  }

  return response.json() as Promise<T>;
}

export interface UploadSourceBody {
  filename: string;
  content: string;
  mimeType: string;
}

export interface SearchBody {
  query: string;
  topK?: number;
  threshold?: number;
}

export interface HealthResponse {
  status: string;
  db: string;
  embedding: string;
}

export interface ModelsResponse {
  models: readonly string[];
}

export const api = {
  // Chat
  sendMessage: (body: ChatRequest): Promise<ChatResponse> =>
    request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify(body) }),

  // Conversations
  listConversations: async (): Promise<readonly Conversation[]> => {
    const res = await request<PaginatedResponse<Conversation>>('/conversations');
    return res.data;
  },

  getConversation: (id: string): Promise<ConversationWithMessages> =>
    request<ConversationWithMessages>(`/conversations/${id}`),

  // Sources
  listSources: (page = 1, pageSize = 20): Promise<PaginatedResponse<Source>> =>
    request<PaginatedResponse<Source>>(`/sources?page=${page}&pageSize=${pageSize}`),

  getSource: (id: string): Promise<Source> => request<Source>(`/sources/${id}`),

  uploadSource: (body: UploadSourceBody): Promise<Source> =>
    request<Source>('/sources/upload', { method: 'POST', body: JSON.stringify(body) }),

  deleteSource: (id: string): Promise<void> =>
    request<void>(`/sources/${id}`, { method: 'DELETE' }),

  reindexSource: (id: string): Promise<void> =>
    request<void>(`/sources/${id}/reindex`, { method: 'POST' }),

  // Search
  search: (body: SearchBody) => request<unknown>('/search', { method: 'POST', body: JSON.stringify(body) }),

  // Config
  getConfig: (): Promise<AppConfig> => request<AppConfig>('/config'),

  updateConfig: (body: Partial<AppConfig>): Promise<AppConfig> =>
    request<AppConfig>('/config', { method: 'PATCH', body: JSON.stringify(body) }),

  getModels: (): Promise<ModelsResponse> => request<ModelsResponse>('/config/models'),

  // Conversations
  deleteConversation: (id: string): Promise<void> =>
    request<void>(`/conversations/${id}`, { method: 'DELETE' }),

  // Health
  health: (): Promise<HealthResponse> => request<HealthResponse>('/health'),
};
