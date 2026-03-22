# Delve API Reference

All endpoints are served under the prefix `/api/v1`. The base URL for a default local installation is `http://localhost:3001/api/v1`.

**Content type:** All request and response bodies are `application/json` unless noted otherwise.

**Authentication:** When `AUTH_ENABLED=true`, include `Authorization: Bearer <token>` on every request. Webhook endpoints use API key authentication via the `X-API-Key` header instead.

**Error shape:** All error responses follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {}
  }
}
```

---

## Table of Contents

- [Health](#health)
- [Collections](#collections)
- [Sources](#sources)
- [Search](#search)
- [Chat](#chat)
- [Conversations](#conversations)
- [Watched Folders](#watched-folders)
- [API Keys](#api-keys)
- [Webhooks](#webhooks)
- [Plugins](#plugins)
- [Config](#config)

---

## Health

### GET /health

Returns the current system health status.

**Auth required:** No

**Response `200 OK`**

```json
{
  "status": "ok",
  "timestamp": "2026-03-22T10:00:00.000Z",
  "db": "ok",
  "embedding": "warn"
}
```

| Field | Type | Values |
|-------|------|--------|
| `status` | string | `ok` \| `degraded` |
| `timestamp` | string | ISO 8601 datetime |
| `db` | string | `ok` \| `error` |
| `embedding` | string | `ok` \| `warn` |

---

## Collections

Collections are named namespaces that group sources, watched folders, and conversations.

### POST /collections

Create a new collection.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "name": "Research Notes",
  "description": "Optional description",
  "metadata": {}
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1–255 characters |
| `description` | string | No | max 2000 characters |
| `metadata` | object | No | arbitrary JSON |

**Response `201 Created`**

```json
{
  "id": "uuid",
  "name": "Research Notes",
  "description": "Optional description",
  "metadata": {},
  "createdAt": "2026-03-22T10:00:00.000Z",
  "updatedAt": "2026-03-22T10:00:00.000Z"
}
```

---

### GET /collections

List all collections with pagination.

**Auth required:** Yes (when enabled)

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Results per page (max 100) |

**Response `200 OK`**

```json
{
  "data": [{ "id": "uuid", "name": "...", "createdAt": "..." }],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### GET /collections/:id

Get a single collection by ID.

**Auth required:** Yes (when enabled)

**Response `200 OK`** — Collection object (same shape as POST response)

**Response `404 Not Found`** — Collection does not exist

---

### PATCH /collections/:id

Update a collection's name, description, or metadata. Only provided fields are changed.

**Auth required:** Yes (when enabled)

**Request body** — Same fields as POST, all optional.

**Response `200 OK`** — Updated collection object

---

### DELETE /collections/:id

Delete a collection.

**Auth required:** Yes (when enabled)

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | string | `reassign` | `cascade` deletes all sources in the collection; `reassign` moves sources to the default collection |

**Response `204 No Content`**

---

## Sources

Sources are ingested documents. Each source is split into chunks and embedded for search.

### POST /sources/upload

Upload a document for ingestion. The file content must be base64-encoded.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "filename": "notes.md",
  "mimeType": "text/markdown",
  "content": "<base64-encoded file bytes>",
  "collectionId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | Original filename including extension |
| `mimeType` | string | Yes | MIME type of the file |
| `content` | string | Yes | Base64-encoded file content |
| `collectionId` | string (UUID) | No | Collection to assign the source to |

**Supported MIME types:** `text/plain`, `text/markdown`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/csv`, `text/tsv`, `application/json`, `text/html`

**Response `201 Created`**

```json
{
  "sourceId": "uuid",
  "chunkCount": 24
}
```

**Response `400 Bad Request`** — Validation error or file too large (max 100 MB)

---

### GET /sources/tags

List all unique tags used across sources, sorted alphabetically.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
["architecture", "meeting-notes", "research"]
```

---

### GET /sources

List sources with pagination and optional collection filter.

**Auth required:** Yes (when enabled)

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Results per page (max 100) |
| `collectionId` | string (UUID) | — | Filter to a specific collection |

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "uuid",
      "filename": "notes.md",
      "mimeType": "text/markdown",
      "status": "ready",
      "chunkCount": 24,
      "tags": ["research"],
      "collectionId": "uuid",
      "createdAt": "2026-03-22T10:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

Source `status` values: `pending` | `processing` | `ready` | `error`

---

### GET /sources/:id

Get a single source by ID.

**Auth required:** Yes (when enabled)

**Response `200 OK`** — Source object (same shape as list item)

**Response `404 Not Found`**

---

### DELETE /sources/:id

Delete a source and all its chunks.

**Auth required:** Yes (when enabled)

**Response `204 No Content`**

---

### POST /sources/:id/reindex

Trigger re-ingestion of an existing source from its stored content.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
{ "message": "Reindexing started" }
```

---

### PATCH /sources/:id/tags

Replace all tags on a source.

**Auth required:** Yes (when enabled)

**Request body**

```json
{ "tags": ["research", "2026"] }
```

**Response `200 OK`**

```json
{ "tags": ["2026", "research"] }
```

---

### POST /sources/bulk-import

Import all supported files from a filesystem directory path.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "directoryPath": "/home/user/documents",
  "tags": ["imported"],
  "collectionId": "uuid"
}
```

**Response `200 OK`**

```json
{
  "imported": 12,
  "skipped": 2,
  "errors": []
}
```

---

## Search

### POST /search

Perform semantic vector search over ingested chunks.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "query": "What are the key risks in the proposal?",
  "topK": 8,
  "threshold": 0.72,
  "sourceIds": ["uuid"],
  "fileTypes": ["text/markdown"],
  "tags": ["research"],
  "dateFrom": "2026-01-01T00:00:00Z",
  "dateTo": "2026-12-31T23:59:59Z",
  "collectionId": "uuid"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | — | Natural language search query (required, max 2000 chars) |
| `topK` | integer | `8` | Number of results (1–50) |
| `threshold` | float | `0.72` | Minimum similarity score (0–1) |
| `sourceIds` | string[] | — | Restrict to specific source IDs |
| `fileTypes` | string[] | — | Restrict to specific MIME types |
| `tags` | string[] | — | Restrict to sources with any of these tags |
| `dateFrom` | string | — | Include sources ingested after this ISO 8601 datetime |
| `dateTo` | string | — | Include sources ingested before this ISO 8601 datetime |
| `collectionId` | string (UUID) | — | Restrict to a specific collection |

**Response `200 OK`**

```json
[
  {
    "chunkId": "uuid",
    "sourceId": "uuid",
    "filename": "notes.md",
    "content": "The key risks identified in the proposal include...",
    "score": 0.89,
    "metadata": {
      "chunkIndex": 3,
      "section": "Risk Analysis"
    }
  }
]
```

---

## Chat

### POST /chat

Send a message and receive a grounded, citation-backed answer.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "message": "What did the team decide about the database?",
  "conversationId": "uuid",
  "model": "claude-3-5-sonnet",
  "sourceIds": ["uuid"],
  "fileTypes": ["text/markdown"],
  "tags": ["meeting-notes"],
  "dateFrom": "2026-01-01T00:00:00Z",
  "dateTo": "2026-12-31T23:59:59Z",
  "collectionId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's question (max 10 000 chars) |
| `conversationId` | string (UUID) | No | Resume an existing conversation |
| `model` | string | No | LLM model to use (defaults to configured model) |
| `sourceIds` | string[] | No | Restrict retrieval to specific sources |
| `fileTypes` | string[] | No | Restrict retrieval to specific MIME types |
| `tags` | string[] | No | Restrict retrieval to sources with these tags |
| `dateFrom` / `dateTo` | string | No | Restrict retrieval to a date range |
| `collectionId` | string (UUID) | No | Restrict retrieval to a collection |

**Response `200 OK`**

```json
{
  "conversationId": "uuid",
  "answer": "The team decided to use PostgreSQL with pgvector...",
  "sources": [
    {
      "chunkId": "uuid",
      "sourceId": "uuid",
      "filename": "meeting-2026-01-15.md",
      "excerpt": "...we agreed to adopt pgvector for semantic search...",
      "score": 0.91
    }
  ],
  "model": "claude-3-5-sonnet",
  "tokensUsed": 1240
}
```

---

## Conversations

### GET /conversations

List all conversations with pagination.

**Auth required:** Yes (when enabled)

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Results per page (max 100) |
| `collectionId` | string (UUID) | — | Filter by collection |

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Database architecture discussion",
      "messageCount": 6,
      "createdAt": "2026-03-22T10:00:00.000Z",
      "updatedAt": "2026-03-22T10:15:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 20
}
```

---

### GET /conversations/:id

Get a conversation with all its messages.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
{
  "id": "uuid",
  "title": "Database architecture discussion",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What database did we choose?",
      "createdAt": "2026-03-22T10:00:00.000Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "You chose PostgreSQL with pgvector...",
      "sources": [...],
      "createdAt": "2026-03-22T10:00:05.000Z"
    }
  ],
  "createdAt": "2026-03-22T10:00:00.000Z",
  "updatedAt": "2026-03-22T10:15:00.000Z"
}
```

---

### GET /conversations/:id/export

Export a conversation as a Markdown document for download.

**Auth required:** Yes (when enabled)

**Response `200 OK`** with `Content-Type: text/markdown`

The response body is a formatted Markdown document of the entire conversation including source citations.

---

### DELETE /conversations/:id

Delete a conversation and all its messages.

**Auth required:** Yes (when enabled)

**Response `204 No Content`**

---

## Watched Folders

Watched folders are filesystem directories that Delve monitors for new or changed files. Files that appear are automatically ingested.

### POST /watched-folders

Add a new watched folder.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "folderPath": "/home/user/notes",
  "recursive": true,
  "collectionId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `folderPath` | string | Yes | Absolute filesystem path to watch |
| `recursive` | boolean | No | Watch subdirectories (default `false`) |
| `collectionId` | string (UUID) | No | Assign ingested sources to this collection |

**Response `201 Created`**

```json
{
  "id": "uuid",
  "folderPath": "/home/user/notes",
  "recursive": true,
  "collectionId": "uuid",
  "createdAt": "2026-03-22T10:00:00.000Z"
}
```

---

### GET /watched-folders

List all watched folders, optionally filtered by collection.

**Auth required:** Yes (when enabled)

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `collectionId` | string (UUID) | Filter to a specific collection |

**Response `200 OK`** — Array of watched folder objects

---

### DELETE /watched-folders/:id

Remove a watched folder. Stops the file watcher; existing ingested sources are not affected.

**Auth required:** Yes (when enabled)

**Response `204 No Content`**

---

### POST /watched-folders/:id/scan

Trigger a full re-scan of a watched folder, ingesting any files not yet indexed.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
{
  "scanned": 45,
  "ingested": 3,
  "skipped": 42
}
```

---

## API Keys

API keys are used to authenticate webhook requests from external systems.

### POST /api-keys

Create a new API key. **The full key is returned only once** — store it securely.

**Auth required:** Yes (when enabled)

**Request body**

```json
{
  "name": "Zapier integration",
  "collectionId": "uuid",
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable label |
| `collectionId` | string (UUID) | No | Default collection for webhook ingestion |
| `expiresAt` | string | No | ISO 8601 expiry datetime |

**Response `201 Created`**

```json
{
  "id": "uuid",
  "name": "Zapier integration",
  "key": "dlv_live_xxxxxxxxxxxxxxxxxxxxxxxx",
  "prefix": "dlv_live_xxxx",
  "collectionId": "uuid",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "createdAt": "2026-03-22T10:00:00.000Z"
}
```

---

### GET /api-keys

List all API keys. The full key is never returned after creation — only the prefix is shown.

**Auth required:** Yes (when enabled)

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `collectionId` | string (UUID) | Filter to a specific collection |

**Response `200 OK`**

```json
[
  {
    "id": "uuid",
    "name": "Zapier integration",
    "prefix": "dlv_live_xxxx",
    "collectionId": "uuid",
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "createdAt": "2026-03-22T10:00:00.000Z"
  }
]
```

---

### DELETE /api-keys/:id

Revoke (permanently delete) an API key. All future requests using this key will be rejected.

**Auth required:** Yes (when enabled)

**Response `204 No Content`**

---

## Webhooks

Webhook endpoints accept content from external systems using an API key for authentication. Pass the API key in the `X-API-Key` header.

The collection to assign ingested content to is determined by the API key's `collectionId` — it cannot be overridden in the request body.

### POST /webhooks/ingest

Ingest raw text content sent directly in the request body.

**Auth required:** API key via `X-API-Key` header

**Request body**

```json
{
  "content": "The meeting discussed quarterly targets...",
  "filename": "q1-meeting.md",
  "fileType": "text/markdown",
  "tags": ["meetings", "q1-2026"],
  "metadata": { "source": "Zapier" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Text content to ingest |
| `filename` | string | Yes | Filename including extension (used to derive MIME type if `fileType` not set) |
| `fileType` | string | No | MIME type override |
| `tags` | string[] | No | Tags to apply to the ingested source |
| `metadata` | object | No | Arbitrary JSON metadata |

**Response `201 Created`**

```json
{
  "sourceId": "uuid",
  "chunkCount": 12
}
```

**Response `401 Unauthorized`** — Missing or invalid API key

**Response `429 Too Many Requests`** — Rate limit exceeded (`WEBHOOK_RATE_LIMIT`)

---

### POST /webhooks/ingest/url

Fetch a URL and ingest its content.

**Auth required:** API key via `X-API-Key` header

**Request body**

```json
{
  "url": "https://example.com/article.html",
  "filename": "article.html",
  "tags": ["web", "reference"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL to fetch |
| `filename` | string | No | Override filename (derived from URL path if omitted) |
| `tags` | string[] | No | Tags to apply |

**Response `201 Created`** — Same shape as `/webhooks/ingest`

**Response `400 Bad Request`** — URL is unreachable or returned a non-2xx status

---

## Plugins

### GET /plugins

List all currently-loaded plugins and the MIME types each handles.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
[
  {
    "name": "pdf-extractor",
    "version": "1.0.0",
    "mimeTypes": ["application/pdf"],
    "description": "Extracts text from PDF files"
  }
]
```

---

### POST /plugins/reload

Re-scan the `PLUGINS_DIR` and reload all plugins without restarting the server.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
{
  "loaded": 3,
  "plugins": ["pdf-extractor", "docx-extractor", "html-extractor"]
}
```

---

## Config

### GET /config

Return the current application configuration.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
{
  "llmModel": "claude-3-5-sonnet",
  "chunkSize": 512,
  "chunkOverlap": 64,
  "topK": 8,
  "similarityThreshold": 0.72,
  "maxContextTokens": 4000,
  "maxConversationTurns": 10
}
```

---

### PATCH /config

Merge the supplied fields into the active configuration. Only provided fields are updated.

**Auth required:** Yes (when enabled)

**Request body** — Partial config object. All fields are optional.

```json
{
  "topK": 12,
  "similarityThreshold": 0.68
}
```

**Response `200 OK`** — Full updated config object

**Response `400 Bad Request`** — Invalid field values

---

### GET /config/models

Retrieve the list of available LLM models from the configured provider.

**Auth required:** Yes (when enabled)

**Response `200 OK`**

```json
{
  "models": [
    "claude-3-5-sonnet",
    "claude-3-opus",
    "gpt-4o",
    "gpt-4-turbo"
  ]
}
```

If the provider is unavailable, returns the default model as a fallback rather than an error.
