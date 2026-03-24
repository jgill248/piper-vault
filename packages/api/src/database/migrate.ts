/**
 * Standalone migration script.
 * Run with: pnpm db:migrate (which uses tsx to execute this file directly).
 *
 * Creates all tables, indexes, and the pgvector extension if they do not
 * already exist. Safe to run multiple times (all statements use IF NOT EXISTS).
 */
import postgres from 'postgres';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString);

async function migrate(): Promise<void> {
  console.log('Running migrations...');

  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log('  extension: vector');

  // sources table
  await sql`
    CREATE TABLE IF NOT EXISTS sources (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename      VARCHAR(500) NOT NULL,
      file_type     VARCHAR(50)  NOT NULL,
      file_size     INTEGER      NOT NULL,
      content_hash  VARCHAR(64)  NOT NULL UNIQUE,
      status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
      chunk_count   INTEGER      NOT NULL DEFAULT 0,
      metadata      JSONB        NOT NULL DEFAULT '{}',
      created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  table: sources');

  // chunks table
  await sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id    UUID    NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      chunk_index  INTEGER NOT NULL,
      content      TEXT    NOT NULL,
      embedding    vector(384),
      token_count  INTEGER NOT NULL,
      page_number  INTEGER,
      metadata     JSONB   NOT NULL DEFAULT '{}',
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  table: chunks');

  // conversations table
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      title      VARCHAR(200)  NOT NULL,
      created_at TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP     NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  table: conversations');

  // messages table
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            VARCHAR(20)  NOT NULL,
      content         TEXT         NOT NULL,
      sources         JSONB,
      model           VARCHAR(100),
      created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  table: messages');

  // Phase 3: add tags column to sources (idempotent via IF NOT EXISTS check)
  await sql`
    ALTER TABLE sources
    ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[]
  `;
  console.log('  migration: sources.tags column');

  // Phase 3: add search_vector column for hybrid BM25 / full-text search
  await sql`ALTER TABLE chunks ADD COLUMN IF NOT EXISTS search_vector tsvector`;
  await sql`CREATE INDEX IF NOT EXISTS chunks_search_vector_idx ON chunks USING gin(search_vector)`;
  // Backfill any existing rows that pre-date the trigger
  await sql`UPDATE chunks SET search_vector = to_tsvector('english', content) WHERE search_vector IS NULL`;
  // Trigger: auto-populate search_vector on INSERT or content UPDATE
  await sql`
    CREATE OR REPLACE FUNCTION chunks_search_vector_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english', NEW.content);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await sql`DROP TRIGGER IF EXISTS chunks_search_vector_update ON chunks`;
  await sql`
    CREATE TRIGGER chunks_search_vector_update
    BEFORE INSERT OR UPDATE OF content ON chunks
    FOR EACH ROW EXECUTE FUNCTION chunks_search_vector_trigger()
  `;
  console.log('  migration: chunks.search_vector + trigger');

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS chunks_source_id_idx ON chunks(source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS sources_content_hash_idx ON sources(content_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS sources_status_idx ON sources(status)`;
  await sql`CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id)`;

  // HNSW index for approximate nearest-neighbour vector search (cosine distance)
  await sql`
    CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING hnsw (embedding vector_cosine_ops)
  `;
  console.log('  indexes: created');

  // Phase 4: Multi-collection support
  // Create collections table
  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(200) NOT NULL,
      description TEXT         NOT NULL DEFAULT '',
      metadata    JSONB        NOT NULL DEFAULT '{}',
      created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  table: collections');

  // Insert the default "Default" collection with the well-known UUID
  await sql`
    INSERT INTO collections (id, name, description)
    VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'Default collection')
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('  seed: default collection');

  // Add collection_id to sources
  await sql`
    ALTER TABLE sources
    ADD COLUMN IF NOT EXISTS collection_id UUID
      NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'
      REFERENCES collections(id)
  `;
  console.log('  migration: sources.collection_id column');

  // Backfill sources — already handled by DEFAULT, but make explicit
  await sql`
    UPDATE sources
    SET collection_id = '00000000-0000-0000-0000-000000000000'
    WHERE collection_id IS NULL
  `;

  // Add collection_id to conversations
  await sql`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS collection_id UUID
      NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'
      REFERENCES collections(id)
  `;
  console.log('  migration: conversations.collection_id column');

  // Backfill conversations
  await sql`
    UPDATE conversations
    SET collection_id = '00000000-0000-0000-0000-000000000000'
    WHERE collection_id IS NULL
  `;

  // Indexes on collection_id columns
  await sql`CREATE INDEX IF NOT EXISTS sources_collection_id_idx ON sources(collection_id)`;
  await sql`CREATE INDEX IF NOT EXISTS conversations_collection_id_idx ON conversations(collection_id)`;
  console.log('  indexes: collection_id indexes created');

  // Drop old unique constraint on sources.content_hash (if it exists)
  // and replace with composite unique constraint on (collection_id, content_hash)
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sources_content_hash_key' AND conrelid = 'sources'::regclass
      ) THEN
        ALTER TABLE sources DROP CONSTRAINT sources_content_hash_key;
      END IF;
    END;
    $$
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sources_collection_id_content_hash_key' AND conrelid = 'sources'::regclass
      ) THEN
        ALTER TABLE sources
        ADD CONSTRAINT sources_collection_id_content_hash_key
        UNIQUE (collection_id, content_hash);
      END IF;
    END;
    $$
  `;
  console.log('  constraint: sources (collection_id, content_hash) unique');

  // Phase 4: Watched folders for auto-ingestion
  await sql`
    CREATE TABLE IF NOT EXISTS watched_folders (
      id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      collection_id UUID      NOT NULL REFERENCES collections(id),
      folder_path   TEXT      NOT NULL,
      recursive     BOOLEAN   NOT NULL DEFAULT true,
      enabled       BOOLEAN   NOT NULL DEFAULT true,
      last_scan_at  TIMESTAMP,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS watched_folders_collection_id_idx ON watched_folders(collection_id)`;
  console.log('  table: watched_folders');

  // Phase 4: API keys table for programmatic ingestion
  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name          VARCHAR(200) NOT NULL,
      key_hash      VARCHAR(64)  NOT NULL UNIQUE,
      prefix        VARCHAR(8)   NOT NULL,
      collection_id UUID         NOT NULL REFERENCES collections(id),
      permissions   JSONB        NOT NULL DEFAULT '{}',
      created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
      last_used_at  TIMESTAMP,
      expires_at    TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS api_keys_collection_id_idx ON api_keys(collection_id)`;
  console.log('  table: api_keys');

  // Phase 4: Users table for JWT-based authentication
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      username      VARCHAR(100) NOT NULL UNIQUE,
      email         VARCHAR(255),
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(20)  NOT NULL DEFAULT 'user',
      created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS users_username_idx ON users(username)`;
  console.log('  table: users');

  // Phase 4: Add nullable user_id FK to collections
  await sql`
    ALTER TABLE collections
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)
  `;
  await sql`CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id)`;
  console.log('  migration: collections.user_id column');

  // Phase 5: Native Knowledge Management — new columns on sources for note support
  await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS is_note BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS content TEXT`;
  await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS parent_path TEXT`;
  await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS title VARCHAR(500)`;
  await sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS frontmatter JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS sources_is_note_idx ON sources(is_note)`;
  await sql`CREATE INDEX IF NOT EXISTS sources_parent_path_idx ON sources(parent_path)`;
  console.log('  migration: sources note columns (is_note, content, parent_path, title, frontmatter)');

  // Phase 5: source_links table for wiki-link graph relationships
  await sql`
    CREATE TABLE IF NOT EXISTS source_links (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id        UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      target_source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
      target_filename  TEXT NOT NULL,
      link_type        TEXT NOT NULL DEFAULT 'wiki-link',
      display_text     TEXT,
      section          TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_links_source ON source_links(source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_links_target ON source_links(target_source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_links_target_filename ON source_links(target_filename)`;
  console.log('  table: source_links');

  // Phase 5: note_folders table for note organization
  await sql`
    CREATE TABLE IF NOT EXISTS note_folders (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path          TEXT NOT NULL UNIQUE,
      collection_id UUID NOT NULL REFERENCES collections(id),
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_note_folders_collection ON note_folders(collection_id)`;
  console.log('  table: note_folders');

  console.log('Migrations complete.');
  await sql.end();
}

migrate().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
