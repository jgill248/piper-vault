import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import {
  collections,
  conversations,
  messages,
  noteFolders,
  sourceLinks,
  sources,
  systemPromptPresets,
  wikiLog,
  wikiPageVersions,
} from '../../database/schema';
import { ImportVaultCommand, type ImportVaultResult } from './import-vault.command';

/**
 * Bulk-upsert size for each table. Postgres has a practical upper bound on
 * the number of parameters per statement; batching keeps memory bounded and
 * avoids that ceiling on large imports.
 */
const IMPORT_BATCH_SIZE = 200;

@CommandHandler(ImportVaultCommand)
export class ImportVaultHandler implements ICommandHandler<ImportVaultCommand> {
  private readonly logger = new Logger(ImportVaultHandler.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(command: ImportVaultCommand): Promise<ImportVaultResult> {
    const { payload } = command;
    let importedCollections = 0;
    let importedSources = 0;
    let importedNotes = 0;
    let importedSourceLinks = 0;
    let importedFolders = 0;
    let importedConversations = 0;
    let importedMessages = 0;
    let importedWikiVersions = 0;
    let importedWikiLog = 0;
    let importedPresets = 0;

    for (const batch of chunks(payload.collections, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(collections)
        .values(batch.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          metadata: c.metadata,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })))
        .onConflictDoUpdate({
          target: collections.id,
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            metadata: sql`excluded.metadata`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      importedCollections += batch.length;
    }

    for (const batch of chunks(payload.sources, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(sources)
        .values(batch.map((s) => ({
          id: s.id,
          filename: s.filename,
          fileType: s.fileType,
          fileSize: s.fileSize,
          contentHash: s.contentHash,
          collectionId: s.collectionId,
          status: s.status,
          chunkCount: 0, // chunks will be regenerated on reprocess
          tags: [...s.tags],
          metadata: s.metadata,
          isNote: s.isNote,
          content: s.content,
          parentPath: s.parentPath,
          title: s.title,
          frontmatter: s.frontmatter,
          isGenerated: s.isGenerated,
          generatedBy: s.generatedBy,
          generationSourceIds: [...s.generationSourceIds],
          lastLintAt: s.lastLintAt !== null ? new Date(s.lastLintAt) : null,
          userReviewed: s.userReviewed,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })))
        .onConflictDoUpdate({
          target: sources.id,
          set: {
            filename: sql`excluded.filename`,
            fileType: sql`excluded.file_type`,
            fileSize: sql`excluded.file_size`,
            contentHash: sql`excluded.content_hash`,
            collectionId: sql`excluded.collection_id`,
            status: sql`excluded.status`,
            tags: sql`excluded.tags`,
            metadata: sql`excluded.metadata`,
            isNote: sql`excluded.is_note`,
            content: sql`excluded.content`,
            parentPath: sql`excluded.parent_path`,
            title: sql`excluded.title`,
            frontmatter: sql`excluded.frontmatter`,
            isGenerated: sql`excluded.is_generated`,
            generatedBy: sql`excluded.generated_by`,
            generationSourceIds: sql`excluded.generation_source_ids`,
            lastLintAt: sql`excluded.last_lint_at`,
            userReviewed: sql`excluded.user_reviewed`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      for (const s of batch) {
        if (s.isNote) importedNotes += 1;
        else importedSources += 1;
      }
    }

    for (const batch of chunks(payload.noteFolders, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(noteFolders)
        .values(batch.map((f) => ({
          id: f.id,
          path: f.path,
          collectionId: f.collectionId,
          sortOrder: f.sortOrder,
          createdAt: new Date(f.createdAt),
        })))
        .onConflictDoUpdate({
          target: noteFolders.id,
          set: {
            path: sql`excluded.path`,
            collectionId: sql`excluded.collection_id`,
            sortOrder: sql`excluded.sort_order`,
          },
        });
      importedFolders += batch.length;
    }

    for (const batch of chunks(payload.sourceLinks, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(sourceLinks)
        .values(batch.map((l) => ({
          id: l.id,
          sourceId: l.sourceId,
          targetSourceId: l.targetSourceId,
          targetFilename: l.targetFilename,
          linkType: l.linkType,
          displayText: l.displayText,
          section: l.section,
          createdAt: new Date(l.createdAt),
        })))
        .onConflictDoUpdate({
          target: sourceLinks.id,
          set: {
            sourceId: sql`excluded.source_id`,
            targetSourceId: sql`excluded.target_source_id`,
            targetFilename: sql`excluded.target_filename`,
            linkType: sql`excluded.link_type`,
            displayText: sql`excluded.display_text`,
            section: sql`excluded.section`,
          },
        });
      importedSourceLinks += batch.length;
    }

    for (const batch of chunks(payload.conversations, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(conversations)
        .values(batch.map((c) => ({
          id: c.id,
          title: c.title,
          collectionId: c.collectionId,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })))
        .onConflictDoUpdate({
          target: conversations.id,
          set: {
            title: sql`excluded.title`,
            collectionId: sql`excluded.collection_id`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      importedConversations += batch.length;

      const allMessages = batch.flatMap((c) =>
        c.messages.map((m) => ({ conversationId: c.id, message: m })),
      );
      for (const mbatch of chunks(allMessages, IMPORT_BATCH_SIZE)) {
        await this.db
          .insert(messages)
          .values(mbatch.map(({ conversationId, message }) => ({
            id: message.id,
            conversationId,
            role: message.role,
            content: message.content,
            sources: message.sources,
            model: message.model,
            createdAt: new Date(message.createdAt),
          })))
          .onConflictDoUpdate({
            target: messages.id,
            set: {
              conversationId: sql`excluded.conversation_id`,
              role: sql`excluded.role`,
              content: sql`excluded.content`,
              sources: sql`excluded.sources`,
              model: sql`excluded.model`,
            },
          });
        importedMessages += mbatch.length;
      }
    }

    for (const batch of chunks(payload.wikiPageVersions, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(wikiPageVersions)
        .values(batch.map((v) => ({
          id: v.id,
          sourceId: v.sourceId,
          versionNumber: v.versionNumber,
          content: v.content,
          changeType: v.changeType,
          changeSummary: v.changeSummary,
          triggeredBy: v.triggeredBy,
          createdAt: new Date(v.createdAt),
        })))
        .onConflictDoUpdate({
          target: wikiPageVersions.id,
          set: {
            versionNumber: sql`excluded.version_number`,
            content: sql`excluded.content`,
            changeType: sql`excluded.change_type`,
            changeSummary: sql`excluded.change_summary`,
            triggeredBy: sql`excluded.triggered_by`,
          },
        });
      importedWikiVersions += batch.length;
    }

    for (const batch of chunks(payload.wikiLog, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(wikiLog)
        .values(batch.map((w) => ({
          id: w.id,
          operation: w.operation,
          summary: w.summary,
          affectedSourceIds: [...w.affectedSourceIds],
          sourceTriggerIds: w.sourceTriggerIds,
          metadata: w.metadata,
          createdAt: new Date(w.createdAt),
        })))
        .onConflictDoUpdate({
          target: wikiLog.id,
          set: {
            operation: sql`excluded.operation`,
            summary: sql`excluded.summary`,
            affectedSourceIds: sql`excluded.affected_source_ids`,
            sourceTriggerIds: sql`excluded.source_trigger_id`,
            metadata: sql`excluded.metadata`,
          },
        });
      importedWikiLog += batch.length;
    }

    for (const batch of chunks(payload.presets, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(systemPromptPresets)
        .values(batch.map((p) => ({
          id: p.id,
          name: p.name,
          persona: p.persona,
          model: p.model,
          isDefault: p.isDefault,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        })))
        .onConflictDoUpdate({
          target: systemPromptPresets.id,
          set: {
            name: sql`excluded.name`,
            persona: sql`excluded.persona`,
            model: sql`excluded.model`,
            isDefault: sql`excluded.is_default`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      importedPresets += batch.length;
    }

    this.logger.log(
      `Imported vault: ${importedCollections} collections, ${importedSources} sources, ${importedNotes} notes, ${importedConversations} conversations, ${importedMessages} messages`,
    );

    return {
      ok: true,
      imported: {
        collections: importedCollections,
        sources: importedSources,
        notes: importedNotes,
        sourceLinks: importedSourceLinks,
        noteFolders: importedFolders,
        conversations: importedConversations,
        messages: importedMessages,
        wikiPageVersions: importedWikiVersions,
        wikiLog: importedWikiLog,
        presets: importedPresets,
      },
      reprocessRecommended: importedSources + importedNotes > 0,
    };
  }
}

function* chunks<T>(arr: readonly T[], size: number): Generator<readonly T[]> {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}
