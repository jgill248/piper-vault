import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
// DEFAULT_COLLECTION_ID is used in migration SQL; referenced here as a literal
// so the Drizzle column default is a SQL expression, not a JS runtime value.
const DEFAULT_COLLECTION_ID_SQL = sql`'00000000-0000-0000-0000-000000000000'::uuid`;

/**
 * Custom Drizzle column type for PostgreSQL `text[]`.
 * Drizzle ORM does not ship a built-in text-array column type, so we define
 * one that serialises a JS string[] to the `{a,b,c}` literal that postgres.js
 * returns and accepts.
 */
const textArray = customType<{ data: string[]; driverParam: string[] }>({
  dataType() {
    return 'text[]';
  },
  toDriver(value: string[]) {
    return value;
  },
  fromDriver(value: unknown) {
    if (Array.isArray(value)) return value as string[];
    return [];
  },
});

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

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const collections = pgTable('collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').default(''),
  metadata: jsonb('metadata').notNull().default({}),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  filename: varchar('filename', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  collectionId: uuid('collection_id')
    .notNull()
    .default(DEFAULT_COLLECTION_ID_SQL)
    .references(() => collections.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  chunkCount: integer('chunk_count').notNull().default(0),
  tags: textArray('tags').notNull().default(sql`ARRAY[]::text[]`),
  metadata: jsonb('metadata').notNull().default({}),
  isNote: boolean('is_note').notNull().default(false),
  content: text('content'),
  parentPath: text('parent_path'),
  title: varchar('title', { length: 500 }),
  frontmatter: jsonb('frontmatter').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sourceLinks = pgTable('source_links', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  targetSourceId: uuid('target_source_id').references(() => sources.id, {
    onDelete: 'set null',
  }),
  targetFilename: text('target_filename').notNull(),
  linkType: text('link_type').notNull().default('wiki-link'),
  displayText: text('display_text'),
  section: text('section'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const noteFolders = pgTable('note_folders', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  path: text('path').notNull().unique(),
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  // tsvector column managed by a DB trigger — read-only from the application layer
  searchVector: text('search_vector'),
  tokenCount: integer('token_count').notNull(),
  pageNumber: integer('page_number'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: varchar('title', { length: 200 }).notNull(),
  collectionId: uuid('collection_id')
    .notNull()
    .default(DEFAULT_COLLECTION_ID_SQL)
    .references(() => collections.id),
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

export const watchedFolders = pgTable('watched_folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectionId: uuid('collection_id').notNull().references(() => collections.id),
  folderPath: text('folder_path').notNull(),
  recursive: boolean('recursive').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  lastScanAt: timestamp('last_scan_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const systemPromptPresets = pgTable('system_prompt_presets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  persona: text('persona').notNull().default(''),
  model: varchar('model', { length: 100 }),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  prefix: varchar('prefix', { length: 8 }).notNull(),
  collectionId: uuid('collection_id').notNull().references(() => collections.id),
  permissions: jsonb('permissions').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type CollectionRow = typeof collections.$inferSelect;
export type NewCollectionRow = typeof collections.$inferInsert;
export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
export type WatchedFolderRow = typeof watchedFolders.$inferSelect;
export type NewWatchedFolderRow = typeof watchedFolders.$inferInsert;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
export type SourceLinkRow = typeof sourceLinks.$inferSelect;
export type NewSourceLinkRow = typeof sourceLinks.$inferInsert;
export type NoteFolderRow = typeof noteFolders.$inferSelect;
export type NewNoteFolderRow = typeof noteFolders.$inferInsert;
export type SystemPromptPresetRow = typeof systemPromptPresets.$inferSelect;
export type NewSystemPromptPresetRow = typeof systemPromptPresets.$inferInsert;
