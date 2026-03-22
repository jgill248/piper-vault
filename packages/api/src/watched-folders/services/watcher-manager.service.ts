import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { FileWatcher } from '@delve/core';
import { FILE_EXTENSIONS } from '@delve/shared';
import type { Result } from '@delve/shared';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { watchedFolders, sources } from '../../database/schema';
import type { WatchedFolderRow } from '../../database/schema';
import { IngestSourceCommand } from '../../sources/commands/ingest-source.command';
import type { IngestSourceResult } from '../../sources/commands/ingest-source.handler';
import { DeleteSourceCommand } from '../../sources/commands/delete-source.command';

@Injectable()
export class WatcherManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatcherManagerService.name);
  private readonly watchers = new Map<string, FileWatcher>();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly commandBus: CommandBus,
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.db
      .select()
      .from(watchedFolders)
      .where(eq(watchedFolders.enabled, true));

    this.logger.log(`Starting watchers for ${rows.length} enabled watched folder(s)`);
    await Promise.all(rows.map((row) => this.startWatching(row)));
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`Stopping ${this.watchers.size} active watcher(s)`);
    await Promise.all(
      [...this.watchers.values()].map((watcher) => watcher.stop()),
    );
    this.watchers.clear();
  }

  async startWatching(watchedFolder: WatchedFolderRow): Promise<void> {
    const { id, folderPath, recursive, collectionId } = watchedFolder;

    if (this.watchers.has(id)) {
      this.logger.debug(`Watcher already active for folder ${id}`);
      return;
    }

    if (!existsSync(folderPath)) {
      this.logger.warn(`Watched folder path does not exist, skipping: "${folderPath}" (id: ${id})`);
      return;
    }

    const watcher = new FileWatcher(
      folderPath,
      {
        onAdd: (filePath) => {
          void this.handleFileAdded(filePath, collectionId);
        },
        onChange: (filePath) => {
          void this.handleFileChanged(filePath, collectionId);
        },
        onUnlink: (filePath) => {
          void this.handleFileRemoved(filePath, collectionId);
        },
        onError: (error) => {
          this.logger.error(`Watcher error for "${folderPath}": ${error.message}`);
        },
      },
      { recursive },
    );

    try {
      await watcher.start();
      this.watchers.set(id, watcher);
      this.logger.log(`Watching "${folderPath}" (id: ${id}, recursive: ${recursive})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to start watcher for "${folderPath}": ${message}`);
    }
  }

  async stopWatching(watchedFolderId: string): Promise<void> {
    const watcher = this.watchers.get(watchedFolderId);
    if (watcher) {
      await watcher.stop();
      this.watchers.delete(watchedFolderId);
      this.logger.log(`Stopped watcher for folder ${watchedFolderId}`);
    }
  }

  private async handleFileAdded(filePath: string, collectionId: string): Promise<void> {
    this.logger.debug(`File added: "${filePath}"`);
    await this.ingestFile(filePath, collectionId);
  }

  private async handleFileChanged(filePath: string, collectionId: string): Promise<void> {
    this.logger.debug(`File changed: "${filePath}"`);
    await this.ingestFile(filePath, collectionId);
  }

  private async handleFileRemoved(filePath: string, collectionId: string): Promise<void> {
    this.logger.debug(`File removed: "${filePath}"`);
    const filename = basename(filePath);

    // Find the source in the collection by filename
    const rows = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          eq(sources.filename, filename),
          eq(sources.collectionId, collectionId),
        ),
      )
      .limit(1);

    const source = rows[0];
    if (source === undefined) {
      this.logger.debug(`No source found for removed file "${filename}" in collection ${collectionId}`);
      return;
    }

    try {
      await this.commandBus.execute(new DeleteSourceCommand(source.id));
      this.logger.log(`Deleted source for removed file "${filename}" (id: ${source.id})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to delete source for removed file "${filename}": ${message}`);
    }
  }

  private async ingestFile(filePath: string, collectionId: string): Promise<void> {
    const filename = basename(filePath);
    const ext = extname(filePath).toLowerCase();
    const mimeType = FILE_EXTENSIONS[ext];

    if (!mimeType) {
      this.logger.debug(`Skipping unsupported file type: "${filePath}"`);
      return;
    }

    try {
      const buffer = await readFile(filePath);
      const result = await this.commandBus.execute<
        IngestSourceCommand,
        Result<IngestSourceResult, string>
      >(new IngestSourceCommand(buffer, filename, mimeType, buffer.byteLength, collectionId));

      if (result.ok) {
        this.logger.log(`Auto-ingested "${filename}" → source ${result.value.sourceId}`);
      } else {
        this.logger.warn(`Auto-ingestion failed for "${filename}": ${result.error ?? 'unknown error'}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Duplicate content conflicts are expected — log at debug level
      if (message.includes('already exists')) {
        this.logger.debug(`Skipping duplicate file "${filename}"`);
      } else {
        this.logger.error(`Error auto-ingesting "${filename}": ${message}`);
      }
    }
  }
}
