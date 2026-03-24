import { API_PREFIX } from '@delve/shared';
import type {
  ChatRequest,
  ChatResponse,
  PaginatedResponse,
  Source,
  Conversation,
  ConversationWithMessages,
  AppConfig,
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
} from '@delve/shared';

export type { AppConfig };

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

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
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

  getModels: (): Promise<ModelsResponse> => request<ModelsResponse>('/config/models'),

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
};
