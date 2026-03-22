import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { walkDirectory } from '@delve/core';
import { MAX_FILE_SIZE } from '@delve/shared';
import type { Result } from '@delve/shared';
import { ScanWatchedFolderCommand } from './scan-watched-folder.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { watchedFolders } from '../../database/schema';
import { IngestSourceCommand } from '../../sources/commands/ingest-source.command';
import type { IngestSourceResult } from '../../sources/commands/ingest-source.handler';

export interface ScanWatchedFolderResult {
  readonly watchedFolderId: string;
  readonly folderPath: string;
  readonly filesFound: number;
  readonly filesIngested: number;
  readonly filesSkipped: number;
  readonly errors: readonly string[];
}

@CommandHandler(ScanWatchedFolderCommand)
export class ScanWatchedFolderHandler implements ICommandHandler<ScanWatchedFolderCommand> {
  private readonly logger = new Logger(ScanWatchedFolderHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: ScanWatchedFolderCommand): Promise<ScanWatchedFolderResult> {
    const { watchedFolderId } = command;

    const rows = await this.db
      .select()
      .from(watchedFolders)
      .where(eq(watchedFolders.id, watchedFolderId))
      .limit(1);

    const folder = rows[0];
    if (folder === undefined) {
      throw new NotFoundException(`Watched folder with id "${watchedFolderId}" not found`);
    }

    const { folderPath, collectionId } = folder;

    const files = walkDirectory(folderPath);
    let filesIngested = 0;
    let filesSkipped = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        if (file.fileSize > MAX_FILE_SIZE) {
          filesSkipped++;
          errors.push(`${file.filename}: exceeds max file size`);
          continue;
        }

        const buffer = readFileSync(file.path);
        const result = await this.commandBus.execute<
          IngestSourceCommand,
          Result<IngestSourceResult, string>
        >(new IngestSourceCommand(buffer, file.filename, file.mimeType, file.fileSize, collectionId));

        if (result.ok) {
          filesIngested++;
        } else {
          filesSkipped++;
          errors.push(`${file.filename}: ${result.error ?? 'ingestion failed'}`);
        }
      } catch (err) {
        filesSkipped++;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${file.filename}: ${message}`);
      }
    }

    // Update lastScanAt timestamp
    await this.db
      .update(watchedFolders)
      .set({ lastScanAt: new Date() })
      .where(eq(watchedFolders.id, watchedFolderId));

    this.logger.log(
      `Scan of "${folderPath}": ${filesIngested} ingested, ${filesSkipped} skipped of ${files.length} found`,
    );

    return {
      watchedFolderId,
      folderPath,
      filesFound: files.length,
      filesIngested,
      filesSkipped,
      errors,
    };
  }
}
