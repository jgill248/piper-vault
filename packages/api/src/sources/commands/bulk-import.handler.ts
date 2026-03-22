import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Logger, BadRequestException, Inject } from '@nestjs/common';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { walkDirectory } from '@delve/core';
import { MAX_FILE_SIZE } from '@delve/shared';
import { BulkImportCommand } from './bulk-import.command';
import { IngestSourceCommand } from './ingest-source.command';
import { UpdateSourceTagsCommand } from './update-source-tags.command';
import type { IngestSourceResult } from './ingest-source.handler';
import type { Result } from '@delve/shared';

export interface BulkImportResult {
  readonly directoryPath: string;
  readonly filesFound: number;
  readonly filesIngested: number;
  readonly filesSkipped: number;
  readonly errors: readonly string[];
}

@CommandHandler(BulkImportCommand)
export class BulkImportHandler implements ICommandHandler<BulkImportCommand> {
  private readonly logger = new Logger(BulkImportHandler.name);

  constructor(@Inject(CommandBus) private readonly commandBus: CommandBus) {}

  async execute(command: BulkImportCommand): Promise<BulkImportResult> {
    // Validate directory exists
    if (!existsSync(command.directoryPath)) {
      throw new BadRequestException({
        error: { code: 'DIRECTORY_NOT_FOUND', message: `Directory not found: ${command.directoryPath}` },
      });
    }

    const stat = statSync(command.directoryPath);
    if (!stat.isDirectory()) {
      throw new BadRequestException({
        error: { code: 'NOT_A_DIRECTORY', message: `Path is not a directory: ${command.directoryPath}` },
      });
    }

    // Walk directory
    const files = walkDirectory(command.directoryPath);
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
        >(new IngestSourceCommand(buffer, file.filename, file.mimeType, file.fileSize, command.collectionId));

        if (result.ok) {
          filesIngested++;

          // Apply tags if provided
          if (command.tags && command.tags.length > 0) {
            try {
              await this.commandBus.execute(
                new UpdateSourceTagsCommand(result.value.sourceId, command.tags),
              );
            } catch (tagErr) {
              const message = tagErr instanceof Error ? tagErr.message : String(tagErr);
              this.logger.warn(`Failed to apply tags to source ${result.value.sourceId}: ${message}`);
            }
          }
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

    this.logger.log(
      `Bulk import from "${command.directoryPath}": ${filesIngested} ingested, ${filesSkipped} skipped of ${files.length} found`,
    );

    return {
      directoryPath: command.directoryPath,
      filesFound: files.length,
      filesIngested,
      filesSkipped,
      errors,
    };
  }
}
