import type { Message } from './conversation.js';

/**
 * Read-only summary of a loaded Delve plugin, returned by GET /api/v1/plugins.
 */
export interface PluginInfo {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly supportedTypes: readonly string[];
}

/**
 * Response from POST /api/v1/plugins/reload.
 */
export interface ReloadPluginsResponse {
  readonly loaded: number;
}

export interface ApiError {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

export interface SearchRequest {
  readonly query: string;
  readonly topK?: number;
  readonly threshold?: number;
  readonly sourceIds?: readonly string[];
  readonly fileTypes?: readonly string[];
  readonly tags?: readonly string[];
  readonly collectionId?: string;
}

export interface ChatRequest {
  readonly message: string;
  readonly conversationId?: string;
  readonly model?: string;
  readonly sourceIds?: readonly string[];
  readonly fileTypes?: readonly string[];
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly tags?: readonly string[];
  readonly collectionId?: string;
}

export interface ChatResponse {
  readonly conversationId: string;
  readonly message: Message;
  readonly suggestedFollowUps?: readonly string[];
}
