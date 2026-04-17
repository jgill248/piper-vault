import type { VaultExportPayload } from '@delve/core';

/**
 * Command: restore the contents of a previously exported vault.
 *
 * Records are upserted by primary key. The command is idempotent — importing
 * the same payload twice produces the same final state. Derived data (chunks
 * and embeddings) is NOT populated by this command; callers should re-run the
 * ingestion pipeline against the restored sources if they need search/chat
 * over imported content.
 */
export class ImportVaultCommand {
  constructor(public readonly payload: VaultExportPayload) {}
}

export interface ImportVaultResult {
  readonly ok: true;
  readonly imported: {
    readonly collections: number;
    readonly sources: number;
    readonly notes: number;
    readonly sourceLinks: number;
    readonly noteFolders: number;
    readonly conversations: number;
    readonly messages: number;
    readonly wikiPageVersions: number;
    readonly wikiLog: number;
    readonly presets: number;
  };
  /**
   * True when one or more sources were imported. The caller should reprocess
   * these sources to regenerate chunks and embeddings before they will be
   * searchable.
   */
  readonly reprocessRecommended: boolean;
}
