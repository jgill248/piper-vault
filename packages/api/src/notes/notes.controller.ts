import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { PaginatedResponse, Source } from '@delve/shared';
import type { NoteFolder } from '@delve/shared';
import { CreateNoteCommand } from './commands/create-note.command';
import { UpdateNoteCommand } from './commands/update-note.command';
import { DeleteNoteCommand } from './commands/delete-note.command';
import { CreateFolderCommand } from './commands/create-folder.command';
import { RenameFolderCommand } from './commands/rename-folder.command';
import { DeleteFolderCommand } from './commands/delete-folder.command';
import { ListNotesQuery } from './queries/list-notes.query';
import { GetNoteQuery } from './queries/get-note.query';
import { GetBacklinksQuery } from './queries/get-backlinks.query';
import { ListFoldersQuery } from './queries/list-folders.query';
import { CreateNoteSchema, UpdateNoteSchema, CreateFolderSchema, RenameFolderSchema } from './dto/create-note.dto';
import type { CreateNoteResult } from './commands/create-note.handler';
import type { BacklinkEntry } from './queries/get-backlinks.handler';
import type { Result } from '@delve/shared';

@Controller('notes')
export class NotesController {
  private readonly logger = new Logger(NotesController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<{ sourceId: string; chunkCount: number }> {
    const parsed = CreateNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;
    const result = await this.commandBus.execute<CreateNoteCommand, Result<CreateNoteResult, string>>(
      new CreateNoteCommand(
        dto.title,
        dto.content,
        dto.collectionId,
        dto.parentPath ?? null,
        dto.tags,
      ),
    );

    if (!result.ok) {
      throw new BadRequestException({
        error: { code: 'NOTE_CREATION_FAILED', message: result.error },
      });
    }

    return { sourceId: result.value.sourceId, chunkCount: result.value.chunkCount };
  }

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('collectionId') collectionId?: string,
    @Query('parentPath') parentPath?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ): Promise<PaginatedResponse<Source>> {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedPageSize = pageSize !== undefined ? parseInt(pageSize, 10) : 20;

    return this.queryBus.execute(
      new ListNotesQuery(
        isNaN(parsedPage) ? 1 : parsedPage,
        isNaN(parsedPageSize) ? 20 : Math.min(parsedPageSize, 100),
        collectionId,
        parentPath,
        search,
        tag,
      ),
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Source & { linkCount: number; backlinkCount: number }> {
    return this.queryBus.execute(new GetNoteQuery(id));
  }

  @Get(':id/backlinks')
  async getBacklinks(@Param('id') id: string): Promise<readonly BacklinkEntry[]> {
    return this.queryBus.execute(new GetBacklinksQuery(id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<{ ok: boolean }> {
    const parsed = UpdateNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const dto = parsed.data;
    const result = await this.commandBus.execute<UpdateNoteCommand, Result<void, string>>(
      new UpdateNoteCommand(id, dto.content, dto.title, dto.parentPath, dto.tags),
    );

    if (!result.ok) {
      throw new BadRequestException({
        error: { code: 'NOTE_UPDATE_FAILED', message: result.error },
      });
    }

    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new DeleteNoteCommand(id));
  }

  // --- Folder endpoints ---

  @Post('folders')
  @HttpCode(HttpStatus.CREATED)
  async createFolder(@Body() body: unknown): Promise<NoteFolder> {
    const parsed = CreateFolderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const result = await this.commandBus.execute<CreateFolderCommand, Result<NoteFolder, string>>(
      new CreateFolderCommand(parsed.data.path, parsed.data.collectionId),
    );

    if (!result.ok) {
      throw new BadRequestException({
        error: { code: 'FOLDER_CREATION_FAILED', message: result.error },
      });
    }

    return result.value;
  }

  @Get('folders')
  async listFolders(
    @Query('collectionId') collectionId?: string,
  ): Promise<readonly NoteFolder[]> {
    return this.queryBus.execute(new ListFoldersQuery(collectionId));
  }

  @Patch('folders/:id')
  async renameFolder(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ ok: boolean }> {
    const parsed = RenameFolderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    await this.commandBus.execute(new RenameFolderCommand(id, parsed.data.newPath));
    return { ok: true };
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFolder(
    @Param('id') id: string,
    @Query('deleteContents') deleteContents?: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteFolderCommand(id, deleteContents === 'true'),
    );
  }
}
