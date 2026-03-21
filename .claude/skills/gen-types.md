# Generate Types

Generates TypeScript type definitions from the Delve specification data model.

## Instructions

When invoked, read the data model from `spec/spec.md` (section 4) and generate TypeScript interfaces for `packages/shared/`.

### Entity Types to Generate

Based on spec section 4, generate types for:

1. **Source** — Ingested file/document (id, filename, file_type, file_size, content_hash, status, chunk_count, metadata, timestamps)
2. **Chunk** — Indexed content segment (id, source_id, chunk_index, content, embedding, token_count, page_number, metadata, timestamp)
3. **Conversation** — Chat session (id, title, timestamps)
4. **Message** — Single message in a conversation (id, conversation_id, role, content, sources, model, timestamp)

### Conventions

- Use `string` for UUID fields (not a UUID type)
- Use union types for enums: `'pending' | 'processing' | 'ready' | 'error'` for status
- Use `'user' | 'assistant' | 'system'` for message roles
- Use `number[]` for embedding vectors
- Use `Record<string, unknown>` for JSONB metadata fields
- Include both creation types (for inserts) and full types (with all fields)
- Export all types from a barrel `index.ts`
