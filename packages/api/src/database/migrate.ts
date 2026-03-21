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

  console.log('Migrations complete.');
  await sql.end();
}

migrate().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
