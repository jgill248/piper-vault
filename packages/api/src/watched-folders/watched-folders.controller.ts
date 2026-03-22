import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { WatchedFolder } from '@delve/shared';
import { CreateWatchedFolderSchema } from './dto/create-watched-folder.dto';
import { AddWatchedFolderCommand } from './commands/add-watched-folder.command';
import { RemoveWatchedFolderCommand } from './commands/remove-watched-folder.command';
import { ScanWatchedFolderCommand } from './commands/scan-watched-folder.command';
import type { ScanWatchedFolderResult } from './commands/scan-watched-folder.handler';
import { ListWatchedFoldersQuery } from './queries/list-watched-folders.query';
import { WatcherManagerService } from './services/watcher-manager.service';
import type { WatchedFolderRow } from '../database/schema';
import { toWatchedFolderResponse } from './dto/watched-folder-response.dto';

@Controller('watched-folders')
export class WatchedFoldersController {
  private readonly logger = new Logger(WatchedFoldersController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
    @Inject(WatcherManagerService) private readonly watcherManager: WatcherManagerService,
  ) {}

  /**
   * POST /api/v1/watched-folders
   * Add a new watched folder.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(@Body() body: unknown): Promise<WatchedFolder> {
    const parsed = CreateWatchedFolderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { collectionId, folderPath, recursive } = parsed.data;

    const row = await this.commandBus.execute<AddWatchedFolderCommand, WatchedFolderRow>(
      new AddWatchedFolderCommand(collectionId, folderPath, recursive),
    );

    // Start the file watcher immediately
    await this.watcherManager.startWatching(row);

    return toWatchedFolderResponse(row);
  }

  /**
   * GET /api/v1/watched-folders
   * List watched folders, optionally filtered by collectionId.
   */
  @Get()
  async list(@Query('collectionId') collectionId?: string): Promise<WatchedFolder[]> {
    return this.queryBus.execute(new ListWatchedFoldersQuery(collectionId));
  }

  /**
   * DELETE /api/v1/watched-folders/:id
   * Remove a watched folder (stops the watcher).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    // Stop the watcher before deleting the record
    await this.watcherManager.stopWatching(id);
    await this.commandBus.execute(new RemoveWatchedFolderCommand(id));
  }

  /**
   * POST /api/v1/watched-folders/:id/scan
   * Force a full re-scan of a watched folder.
   */
  @Post(':id/scan')
  @HttpCode(HttpStatus.OK)
  async scan(@Param('id') id: string): Promise<ScanWatchedFolderResult> {
    return this.commandBus.execute(new ScanWatchedFolderCommand(id));
  }
}
