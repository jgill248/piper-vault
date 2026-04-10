import { API_PREFIX } from '@delve/shared';
import type {
  ChatRequest,
  ChatResponse,
  PaginatedResponse,
  Source,
  Conversation,
  ConversationWithMessages,
  AppConfig,
  LlmProviderName,
  LlmProviderStatus,
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
  PluginInfo,
  ReloadPluginsResponse,
  ApiKey,
  ApiKeyCreatedResponse,
  CreateApiKeyInput,
  WatchedFolder,
  CreateWatchedFolderInput,
  LoginInput,
  RegisterInput,
  AuthResponse,
  User,
  NoteFolder,
  SourceLink,
  SystemPromptPreset,
  CreatePresetInput,
  UpdatePresetInput,
} from '@delve/shared';

export type { AppConfig };

/** Events emitted by the /chat/stream SSE endpoint. */
export type StreamEvent =
  | { type: 'meta'; conversationId: string; messageId: string }
  | { type: 'delta'; content: string }
  | { type: 'sources'; sourceIds: string[] }
  | { type: 'done'; model?: string; tokensUsed?: number }
  | { type: 'error'; message: string };

const BASE_URL = API_PREFIX;

/** Module-level token store — set by AuthContext after login/register. */
let _authToken: string | null = null;

/** Called by AuthContext to inject the current JWT into outgoing requests. */
export function setAuthToken(token: string | null): void {
  _authToken = token;
}

/** Called by AuthContext when a 401 is received so it can clear the session. */
let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  _onUnauthorized = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders: Record<string, string> =
    _authToken ? { Authorization: `Bearer ${_authToken}` } : {};

  const hasBody = options?.body !== undefined;
  const contentTypeHeaders: Record<string, string> = hasBody
    ? { 'Content-Type': 'application/json' }
    : {};

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...contentTypeHeaders,
      ...authHeaders,
      ...options?.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    _onUnauthorized?.();
    const error = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message ??
        'Unauthorized',
    );
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message ?? 'Request failed',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
  ApiKey,
  ApiKeyCreatedResponse,
  CreateApiKeyInput,
  WatchedFolder,
  CreateWatchedFolderInput,
  LoginInput,
  RegisterInput,
  AuthResponse,
  User,
};

export type DeleteCollectionMode = 'cascade' | 'reassign';

export interface UploadSourceBody {
  filename: string;
  content: string;
  mimeType: string;
  collectionId?: string;
}

export interface SearchBody {
  query: string;
  topK?: number;
  threshold?: number;
  collectionId?: string;
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

  /**
   * Stream a chat response via SSE. Returns an async iterable of parsed events.
   */
  sendMessageStream: async function* (body: ChatRequest): AsyncGenerator<StreamEvent> {
    const authHeaders: Record<string, string> =
      _authToken ? { Authorization: `Bearer ${_authToken}` } : {};

    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      _onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(
        (error as { error?: { message?: string } }).error?.message ?? 'Request failed',
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            yield JSON.parse(data) as StreamEvent;
          } catch {
            // Skip malformed events
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  // Conversations
  listConversations: async (collectionId?: string): Promise<readonly Conversation[]> => {
    const params = collectionId ? `?collectionId=${collectionId}` : '';
    const res = await request<PaginatedResponse<Conversation>>(`/conversations${params}`);
    return res.data;
  },

  getConversation: (id: string): Promise<ConversationWithMessages> =>
    request<ConversationWithMessages>(`/conversations/${id}`),

  // Collections
  listCollections: (): Promise<PaginatedResponse<Collection>> =>
    request<PaginatedResponse<Collection>>('/collections'),

  getCollection: (id: string): Promise<Collection> =>
    request<Collection>(`/collections/${id}`),

  createCollection: (body: CreateCollectionInput): Promise<Collection> =>
    request<Collection>('/collections', { method: 'POST', body: JSON.stringify(body) }),

  updateCollection: (id: string, body: UpdateCollectionInput): Promise<Collection> =>
    request<Collection>(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteCollection: (id: string, mode: DeleteCollectionMode): Promise<void> =>
    request<void>(`/collections/${id}?mode=${mode}`, { method: 'DELETE' }),

  // Sources
  listSources: (page = 1, pageSize = 20, collectionId?: string): Promise<PaginatedResponse<Source>> => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (collectionId) params.set('collectionId', collectionId);
    return request<PaginatedResponse<Source>>(`/sources?${params.toString()}`);
  },

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

  getModels: (provider?: string): Promise<ModelsResponse> => {
    const url = provider ? `/config/models?provider=${encodeURIComponent(provider)}` : '/config/models';
    return request<ModelsResponse>(url);
  },

  getProviderSettings: (): Promise<LlmProviderStatus[]> =>
    request<LlmProviderStatus[]>('/config/providers'),

  updateProviderSettings: (
    provider: LlmProviderName,
    body: { baseUrl?: string; apiKey?: string },
  ): Promise<LlmProviderStatus> =>
    request<LlmProviderStatus>(`/config/providers/${provider}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Conversations
  deleteConversation: (id: string): Promise<void> =>
    request<void>(`/conversations/${id}`, { method: 'DELETE' }),

  // Tags
  listTags: (): Promise<string[]> => request<string[]>('/sources/tags'),

  updateSourceTags: (id: string, tags: string[]): Promise<{ tags: string[] }> =>
    request<{ tags: string[] }>(`/sources/${id}/tags`, {
      method: 'PATCH',
      body: JSON.stringify({ tags }),
    }),

  // Bulk import
  bulkImport: (directoryPath: string, tags?: string[], collectionId?: string): Promise<{
    directoryPath: string;
    filesFound: number;
    filesIngested: number;
    filesSkipped: number;
    errors: string[];
  }> =>
    request(`/sources/bulk-import`, {
      method: 'POST',
      body: JSON.stringify({ directoryPath, tags, collectionId }),
    }),

  // Export conversation
  exportConversation: async (id: string): Promise<string> => {
    const response = await fetch(`${BASE_URL}/conversations/${id}/export`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Export failed');
    return response.text();
  },

  // Health
  health: (): Promise<HealthResponse> => request<HealthResponse>('/health'),

  // Auth
  login: (input: LoginInput): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  register: (input: RegisterInput): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getMe: async (token?: string): Promise<User | null> => {
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    try {
      const response = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!response.ok) return null;
      return response.json() as Promise<User | null>;
    } catch {
      return null;
    }
  },

  // Plugins
  listPlugins: (): Promise<readonly PluginInfo[]> =>
    request<readonly PluginInfo[]>('/plugins'),

  reloadPlugins: (): Promise<ReloadPluginsResponse> =>
    request<ReloadPluginsResponse>('/plugins/reload', { method: 'POST' }),

  // API Keys
  listApiKeys: (collectionId?: string): Promise<ApiKey[]> => {
    const params = collectionId ? `?collectionId=${collectionId}` : '';
    return request<ApiKey[]>(`/api-keys${params}`);
  },

  createApiKey: (input: CreateApiKeyInput): Promise<ApiKeyCreatedResponse> =>
    request<ApiKeyCreatedResponse>('/api-keys', { method: 'POST', body: JSON.stringify(input) }),

  revokeApiKey: (id: string): Promise<void> =>
    request<void>(`/api-keys/${id}`, { method: 'DELETE' }),

  // Watched Folders
  listWatchedFolders: (collectionId?: string): Promise<WatchedFolder[]> => {
    const params = collectionId ? `?collectionId=${collectionId}` : '';
    return request<WatchedFolder[]>(`/watched-folders${params}`);
  },

  addWatchedFolder: (input: CreateWatchedFolderInput): Promise<WatchedFolder> =>
    request<WatchedFolder>('/watched-folders', { method: 'POST', body: JSON.stringify(input) }),

  removeWatchedFolder: (id: string): Promise<void> =>
    request<void>(`/watched-folders/${id}`, { method: 'DELETE' }),

  scanWatchedFolder: (id: string): Promise<{
    watchedFolderId: string;
    folderPath: string;
    filesFound: number;
    filesIngested: number;
    filesSkipped: number;
    errors: readonly string[];
  }> =>
    request(`/watched-folders/${id}/scan`, { method: 'POST' }),

  // --- Notes ---

  createNote: (body: {
    title: string;
    content: string;
    collectionId?: string;
    parentPath?: string | null;
    tags?: string[];
  }): Promise<{ sourceId: string; chunkCount: number }> =>
    request('/notes', { method: 'POST', body: JSON.stringify(body) }),

  listNotes: async (params?: {
    page?: number;
    pageSize?: number;
    collectionId?: string;
    parentPath?: string;
    search?: string;
    tag?: string;
  }): Promise<PaginatedResponse<Source>> => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params?.collectionId) sp.set('collectionId', params.collectionId);
    if (params?.parentPath !== undefined) sp.set('parentPath', params.parentPath);
    if (params?.search) sp.set('search', params.search);
    if (params?.tag) sp.set('tag', params.tag);
    const qs = sp.toString();
    return request<PaginatedResponse<Source>>(`/notes${qs ? `?${qs}` : ''}`);
  },

  getNote: (id: string): Promise<Source & { linkCount: number; backlinkCount: number }> =>
    request(`/notes/${id}`),

  updateNote: (id: string, body: {
    content?: string;
    title?: string;
    parentPath?: string | null;
    tags?: string[];
  }): Promise<{ ok: boolean }> =>
    request(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteNote: (id: string): Promise<void> =>
    request<void>(`/notes/${id}`, { method: 'DELETE' }),

  getBacklinks: (id: string): Promise<readonly {
    link: SourceLink;
    sourceFilename: string;
    sourceTitle: string | null;
  }[]> =>
    request(`/notes/${id}/backlinks`),

  getGraph: (collectionId?: string): Promise<{
    nodes: readonly { id: string; title: string | null; filename: string; isNote: boolean; linkCount: number; backlinkCount: number }[];
    edges: readonly { source: string; target: string; linkType: string }[];
  }> => {
    const qs = collectionId ? `?collectionId=${collectionId}` : '';
    return request(`/notes/graph${qs}`);
  },

  getSuggestions: (id: string, limit?: number): Promise<readonly {
    sourceId: string;
    title: string | null;
    filename: string;
    score: number;
  }[]> => {
    const qs = limit ? `?limit=${limit}` : '';
    return request(`/notes/${id}/suggestions${qs}`);
  },

  // --- Note Folders ---

  createFolder: (body: { path: string; collectionId?: string }): Promise<NoteFolder> =>
    request('/notes/folders', { method: 'POST', body: JSON.stringify(body) }),

  listFolders: async (collectionId?: string): Promise<readonly NoteFolder[]> => {
    const qs = collectionId ? `?collectionId=${collectionId}` : '';
    return request<readonly NoteFolder[]>(`/notes/folders${qs}`);
  },

  renameFolder: (id: string, newPath: string): Promise<{ ok: boolean }> =>
    request(`/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ newPath }) }),

  deleteFolder: (id: string, deleteContents?: boolean): Promise<void> =>
    request<void>(`/notes/folders/${id}?deleteContents=${deleteContents ?? false}`, { method: 'DELETE' }),

  // --- Presets ---

  listPresets: (): Promise<SystemPromptPreset[]> =>
    request<SystemPromptPreset[]>('/presets'),

  getPreset: (id: string): Promise<SystemPromptPreset> =>
    request<SystemPromptPreset>(`/presets/${id}`),

  createPreset: (body: CreatePresetInput): Promise<SystemPromptPreset> =>
    request<SystemPromptPreset>('/presets', { method: 'POST', body: JSON.stringify(body) }),

  updatePreset: (id: string, body: UpdatePresetInput): Promise<SystemPromptPreset> =>
    request<SystemPromptPreset>(`/presets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deletePreset: (id: string): Promise<void> =>
    request<void>(`/presets/${id}`, { method: 'DELETE' }),

  // --- Wiki ---

  promoteToWiki: (body: { conversationId: string; messageId?: string; collectionId?: string }): Promise<{ ok: boolean; value?: { sourceId: string; title: string }; error?: string }> =>
    request('/wiki/promote', { method: 'POST', body: JSON.stringify(body) }),

  runWikiLint: (body?: { collectionId?: string }): Promise<{ ok: boolean; value?: { issues: WikiLintIssue[]; summary: string }; error?: string }> =>
    request('/wiki/lint', { method: 'POST', body: JSON.stringify(body ?? {}) }),

  initializeWiki: (body?: { collectionId?: string }): Promise<{
    ok: boolean;
    value?: {
      totalEligible: number;
      sourcesProcessed: number;
      sourcesSkipped: number;
      errors: string[];
      summary: string;
    };
    error?: string;
  }> =>
    request('/wiki/initialize', { method: 'POST', body: JSON.stringify(body ?? {}) }),

  getWikiLog: (params?: { limit?: number; offset?: number; operation?: string }): Promise<{ items: WikiLogItem[]; total: number }> => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.operation) qs.set('operation', params.operation);
    const query = qs.toString();
    return request(`/wiki/log${query ? `?${query}` : ''}`);
  },

  getWikiIndex: (collectionId?: string): Promise<{ categories: { name: string; pages: { id: string; title: string; summary: string }[] }[] }> => {
    const qs = collectionId ? `?collectionId=${collectionId}` : '';
    return request(`/wiki/index${qs}`);
  },
};

// --- Wiki types (used by client only) ---

export interface WikiLintIssue {
  type: string;
  severity: string;
  description: string;
  affectedPages: string[];
  suggestedFix: string;
}

export interface WikiLogItem {
  id: string;
  operation: string;
  summary: string;
  affectedSourceIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}
