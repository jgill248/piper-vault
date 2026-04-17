/**
 * Vault export / import format.
 *
 * This module defines the portable JSON payload produced by a full-vault
 * export and consumed by a matching import. The goal is "download my vault":
 * users must be able to leave a Piper Vault deployment and carry all of
 * their knowledge somewhere else — including another Piper Vault instance.
 *
 * The format is intentionally flat JSON. Derived data (chunks, embeddings,
 * search indexes) is NOT included: embeddings are model-specific and must be
 * regenerated on the destination using that deployment's embedder. Transient
 * state (watched folders, API keys, auth users) is also omitted — those are
 * per-deployment concerns, not vault content.
 */

export const VAULT_EXPORT_FORMAT_VERSION = 1;

export interface VaultExportManifest {
  readonly formatVersion: number;
  readonly exportedAt: string;
  readonly appVersion?: string;
  readonly counts: VaultExportCounts;
}

export interface VaultExportCounts {
  readonly collections: number;
  readonly sources: number;
  readonly notes: number;
  readonly conversations: number;
  readonly messages: number;
  readonly noteFolders: number;
  readonly sourceLinks: number;
  readonly wikiPageVersions: number;
  readonly wikiLog: number;
  readonly presets: number;
}

/**
 * Serialized collection record.
 */
export interface ExportedCollection {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Serialized source record. `content` is inlined for text-type sources and
 * notes. Binary-type sources (pdf, docx, etc.) are exported with content set
 * to null — the source file must be re-ingested separately at the destination.
 */
export interface ExportedSource {
  readonly id: string;
  readonly filename: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly contentHash: string;
  readonly collectionId: string;
  readonly status: string;
  readonly chunkCount: number;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly isNote: boolean;
  readonly content: string | null;
  readonly parentPath: string | null;
  readonly title: string | null;
  readonly frontmatter: Record<string, unknown>;
  readonly isGenerated: boolean;
  readonly generatedBy: string | null;
  readonly generationSourceIds: readonly string[];
  readonly lastLintAt: string | null;
  readonly userReviewed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExportedSourceLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetSourceId: string | null;
  readonly targetFilename: string;
  readonly linkType: string;
  readonly displayText: string | null;
  readonly section: string | null;
  readonly createdAt: string;
}

export interface ExportedNoteFolder {
  readonly id: string;
  readonly path: string;
  readonly collectionId: string;
  readonly sortOrder: number;
  readonly createdAt: string;
}

export interface ExportedConversation {
  readonly id: string;
  readonly title: string;
  readonly collectionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly ExportedMessage[];
}

export interface ExportedMessage {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly sources: readonly string[] | null;
  readonly model: string | null;
  readonly createdAt: string;
}

export interface ExportedWikiPageVersion {
  readonly id: string;
  readonly sourceId: string;
  readonly versionNumber: number;
  readonly content: string;
  readonly changeType: string;
  readonly changeSummary: string | null;
  readonly triggeredBy: string | null;
  readonly createdAt: string;
}

export interface ExportedWikiLogEntry {
  readonly id: string;
  readonly operation: string;
  readonly summary: string;
  readonly affectedSourceIds: readonly string[];
  readonly sourceTriggerIds: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface ExportedPreset {
  readonly id: string;
  readonly name: string;
  readonly persona: string;
  readonly model: string | null;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VaultExportPayload {
  readonly manifest: VaultExportManifest;
  readonly collections: readonly ExportedCollection[];
  readonly sources: readonly ExportedSource[];
  readonly sourceLinks: readonly ExportedSourceLink[];
  readonly noteFolders: readonly ExportedNoteFolder[];
  readonly conversations: readonly ExportedConversation[];
  readonly wikiPageVersions: readonly ExportedWikiPageVersion[];
  readonly wikiLog: readonly ExportedWikiLogEntry[];
  readonly presets: readonly ExportedPreset[];
}

export interface VaultExportInput {
  readonly collections: readonly ExportedCollection[];
  readonly sources: readonly ExportedSource[];
  readonly sourceLinks: readonly ExportedSourceLink[];
  readonly noteFolders: readonly ExportedNoteFolder[];
  readonly conversations: readonly ExportedConversation[];
  readonly wikiPageVersions: readonly ExportedWikiPageVersion[];
  readonly wikiLog: readonly ExportedWikiLogEntry[];
  readonly presets: readonly ExportedPreset[];
  readonly appVersion?: string;
}

/**
 * Assembles a VaultExportPayload from pre-serialized records. This function
 * is pure: the caller is responsible for loading records from storage and
 * converting Date → ISO string.
 */
export function buildVaultExport(input: VaultExportInput): VaultExportPayload {
  const manifest: VaultExportManifest = {
    formatVersion: VAULT_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(input.appVersion !== undefined ? { appVersion: input.appVersion } : {}),
    counts: {
      collections: input.collections.length,
      sources: input.sources.filter((s) => !s.isNote).length,
      notes: input.sources.filter((s) => s.isNote).length,
      conversations: input.conversations.length,
      messages: input.conversations.reduce((sum, c) => sum + c.messages.length, 0),
      noteFolders: input.noteFolders.length,
      sourceLinks: input.sourceLinks.length,
      wikiPageVersions: input.wikiPageVersions.length,
      wikiLog: input.wikiLog.length,
      presets: input.presets.length,
    },
  };

  return {
    manifest,
    collections: input.collections,
    sources: input.sources,
    sourceLinks: input.sourceLinks,
    noteFolders: input.noteFolders,
    conversations: input.conversations,
    wikiPageVersions: input.wikiPageVersions,
    wikiLog: input.wikiLog,
    presets: input.presets,
  };
}

export interface VaultImportValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates that a parsed object looks like a VaultExportPayload this build
 * understands. Does NOT validate every field — just the structural contract
 * and format version. Deeper validation happens at insert time.
 */
export function validateVaultExportPayload(candidate: unknown): VaultImportValidation {
  const errors: string[] = [];

  if (candidate === null || typeof candidate !== 'object') {
    return { ok: false, errors: ['Payload is not a JSON object'] };
  }
  const obj = candidate as Record<string, unknown>;

  const manifest = obj['manifest'] as Record<string, unknown> | undefined;
  if (!manifest || typeof manifest !== 'object') {
    errors.push('Missing manifest');
  } else {
    const version = manifest['formatVersion'];
    if (typeof version !== 'number') {
      errors.push('Manifest missing formatVersion');
    } else if (version > VAULT_EXPORT_FORMAT_VERSION) {
      errors.push(
        `Export was produced with format version ${version}, but this build only understands up to ${VAULT_EXPORT_FORMAT_VERSION}`,
      );
    }
  }

  const arrayFields: readonly string[] = [
    'collections',
    'sources',
    'sourceLinks',
    'noteFolders',
    'conversations',
    'wikiPageVersions',
    'wikiLog',
    'presets',
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(obj[field])) {
      errors.push(`Field ${field} must be an array`);
    }
  }

  return { ok: errors.length === 0, errors };
}
