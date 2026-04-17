import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import {
  buildVaultExport,
  type ExportedCollection,
  type ExportedConversation,
  type ExportedMessage,
  type ExportedNoteFolder,
  type ExportedPreset,
  type ExportedSource,
  type ExportedSourceLink,
  type ExportedWikiLogEntry,
  type ExportedWikiPageVersion,
  type VaultExportPayload,
} from '@delve/core';
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
import { ExportVaultQuery } from './export-vault.query';

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toIsoRequired(value: Date | string | null | undefined): string {
  return toIso(value) ?? new Date(0).toISOString();
}

@QueryHandler(ExportVaultQuery)
export class ExportVaultHandler implements IQueryHandler<ExportVaultQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: ExportVaultQuery): Promise<VaultExportPayload> {
    const { collectionId, includeConversations = true } = query.options;

    const collectionRows = collectionId
      ? await this.db.select().from(collections).where(eq(collections.id, collectionId))
      : await this.db.select().from(collections);

    const collectionIds = collectionRows.map((c) => c.id);

    const sourceRows = collectionIds.length > 0
      ? await this.db
          .select()
          .from(sources)
          .where(inArray(sources.collectionId, collectionIds))
          .orderBy(asc(sources.createdAt))
      : [];

    const sourceIds = sourceRows.map((s) => s.id);

    const sourceLinkRows = sourceIds.length > 0
      ? await this.db
          .select()
          .from(sourceLinks)
          .where(inArray(sourceLinks.sourceId, sourceIds))
      : [];

    const folderRows = collectionIds.length > 0
      ? await this.db
          .select()
          .from(noteFolders)
          .where(inArray(noteFolders.collectionId, collectionIds))
      : [];

    const wikiVersionRows = sourceIds.length > 0
      ? await this.db
          .select()
          .from(wikiPageVersions)
          .where(inArray(wikiPageVersions.sourceId, sourceIds))
          .orderBy(asc(wikiPageVersions.versionNumber))
      : [];

    const wikiLogRows = await this.db.select().from(wikiLog).orderBy(asc(wikiLog.createdAt));

    const presetRows = await this.db.select().from(systemPromptPresets);

    let conversationRows: (typeof conversations.$inferSelect)[] = [];
    let messageRows: (typeof messages.$inferSelect)[] = [];
    if (includeConversations && collectionIds.length > 0) {
      conversationRows = await this.db
        .select()
        .from(conversations)
        .where(inArray(conversations.collectionId, collectionIds))
        .orderBy(asc(conversations.createdAt));
      const conversationIds = conversationRows.map((c) => c.id);
      if (conversationIds.length > 0) {
        messageRows = await this.db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds))
          .orderBy(asc(messages.createdAt));
      }
    }

    const messagesByConversation = new Map<string, ExportedMessage[]>();
    for (const m of messageRows) {
      const list = messagesByConversation.get(m.conversationId) ?? [];
      list.push({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: (m.sources as readonly string[] | null) ?? null,
        model: m.model,
        createdAt: toIsoRequired(m.createdAt),
      });
      messagesByConversation.set(m.conversationId, list);
    }

    const collectionsOut: ExportedCollection[] = collectionRows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      metadata: (c.metadata ?? {}) as Record<string, unknown>,
      createdAt: toIsoRequired(c.createdAt),
      updatedAt: toIsoRequired(c.updatedAt),
    }));

    const sourcesOut: ExportedSource[] = sourceRows.map((s) => ({
      id: s.id,
      filename: s.filename,
      fileType: s.fileType,
      fileSize: s.fileSize,
      contentHash: s.contentHash,
      collectionId: s.collectionId,
      status: s.status,
      chunkCount: s.chunkCount,
      tags: s.tags,
      metadata: (s.metadata ?? {}) as Record<string, unknown>,
      isNote: s.isNote,
      content: s.content ?? null,
      parentPath: s.parentPath ?? null,
      title: s.title ?? null,
      frontmatter: (s.frontmatter ?? {}) as Record<string, unknown>,
      isGenerated: s.isGenerated,
      generatedBy: s.generatedBy ?? null,
      generationSourceIds: s.generationSourceIds,
      lastLintAt: toIso(s.lastLintAt),
      userReviewed: s.userReviewed,
      createdAt: toIsoRequired(s.createdAt),
      updatedAt: toIsoRequired(s.updatedAt),
    }));

    const sourceLinksOut: ExportedSourceLink[] = sourceLinkRows.map((l) => ({
      id: l.id,
      sourceId: l.sourceId,
      targetSourceId: l.targetSourceId,
      targetFilename: l.targetFilename,
      linkType: l.linkType,
      displayText: l.displayText,
      section: l.section,
      createdAt: toIsoRequired(l.createdAt),
    }));

    const folderRowsOut: ExportedNoteFolder[] = folderRows.map((f) => ({
      id: f.id,
      path: f.path,
      collectionId: f.collectionId,
      sortOrder: f.sortOrder,
      createdAt: toIsoRequired(f.createdAt),
    }));

    const conversationsOut: ExportedConversation[] = conversationRows.map((c) => ({
      id: c.id,
      title: c.title,
      collectionId: c.collectionId,
      createdAt: toIsoRequired(c.createdAt),
      updatedAt: toIsoRequired(c.updatedAt),
      messages: messagesByConversation.get(c.id) ?? [],
    }));

    const wikiVersionsOut: ExportedWikiPageVersion[] = wikiVersionRows.map((v) => ({
      id: v.id,
      sourceId: v.sourceId,
      versionNumber: v.versionNumber,
      content: v.content,
      changeType: v.changeType,
      changeSummary: v.changeSummary,
      triggeredBy: v.triggeredBy,
      createdAt: toIsoRequired(v.createdAt),
    }));

    const wikiLogOut: ExportedWikiLogEntry[] = wikiLogRows.map((w) => ({
      id: w.id,
      operation: w.operation,
      summary: w.summary,
      affectedSourceIds: w.affectedSourceIds,
      sourceTriggerIds: w.sourceTriggerIds,
      metadata: (w.metadata ?? {}) as Record<string, unknown>,
      createdAt: toIsoRequired(w.createdAt),
    }));

    const presetsOut: ExportedPreset[] = presetRows.map((p) => ({
      id: p.id,
      name: p.name,
      persona: p.persona,
      model: p.model,
      isDefault: p.isDefault,
      createdAt: toIsoRequired(p.createdAt),
      updatedAt: toIsoRequired(p.updatedAt),
    }));

    return buildVaultExport({
      collections: collectionsOut,
      sources: sourcesOut,
      sourceLinks: sourceLinksOut,
      noteFolders: folderRowsOut,
      conversations: conversationsOut,
      wikiPageVersions: wikiVersionsOut,
      wikiLog: wikiLogOut,
      presets: presetsOut,
    });
  }
}
