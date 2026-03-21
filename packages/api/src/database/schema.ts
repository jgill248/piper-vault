import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Custom Drizzle column type for pgvector's `vector(384)` type.
 * Serialises a JS number[] to the `[x,y,z,...]` literal that pgvector expects,
 * and deserialises the returned string back to number[].
 */
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown) {
    const str = value as string;
    return str.slice(1, -1).split(',').map(Number);
  },
});

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  filename: varchar('filename', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  fileSize: integer('file_size').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  chunkCount: integer('chunk_count').notNull().default(0),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  tokenCount: integer('token_count').notNull(),
  pageNumber: integer('page_number'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: varchar('title', { length: 200 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources'),
  model: varchar('model', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
