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
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Collection, PaginatedResponse } from '@delve/shared';
import { CreateCollectionCommand } from './commands/create-collection.command';
import { UpdateCollectionCommand } from './commands/update-collection.command';
import { DeleteCollectionCommand } from './commands/delete-collection.command';
import type { DeleteCollectionMode } from './commands/delete-collection.command';
import { ListCollectionsQuery } from './queries/list-collections.query';
import { GetCollectionQuery } from './queries/get-collection.query';
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
} from './dto/create-collection.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserRow } from '../database/schema';

@Controller('collections')
export class CollectionsController {
  private readonly logger = new Logger(CollectionsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /api/v1/collections
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: unknown,
    @CurrentUser() user?: UserRow,
  ): Promise<Collection> {
    const parsed = CreateCollectionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { name, description, metadata } = parsed.data;
    return this.commandBus.execute(
      new CreateCollectionCommand(
        name,
        description,
        metadata as Record<string, unknown> | undefined,
        user?.id,
      ),
    );
  }

  /**
   * GET /api/v1/collections
   */
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: UserRow,
  ): Promise<PaginatedResponse<Collection>> {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedPageSize = pageSize !== undefined ? parseInt(pageSize, 10) : 20;

    return this.queryBus.execute(
      new ListCollectionsQuery(
        isNaN(parsedPage) ? 1 : parsedPage,
        isNaN(parsedPageSize) ? 20 : Math.min(parsedPageSize, 100),
        user?.id,
        user?.role === 'admin',
      ),
    );
  }

  /**
   * GET /api/v1/collections/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Collection> {
    return this.queryBus.execute(new GetCollectionQuery(id));
  }

  /**
   * PATCH /api/v1/collections/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Collection> {
    const parsed = UpdateCollectionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { name, description, metadata } = parsed.data;
    return this.commandBus.execute(
      new UpdateCollectionCommand(
        id,
        name,
        description,
        metadata as Record<string, unknown> | undefined,
      ),
    );
  }

  /**
   * DELETE /api/v1/collections/:id
   * Query param: mode=cascade|reassign (default: reassign)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Query('mode') mode?: string,
    @CurrentUser() user?: UserRow,
  ): Promise<void> {
    const deleteMode: DeleteCollectionMode =
      mode === 'cascade' ? 'cascade' : 'reassign';
    await this.commandBus.execute(
      new DeleteCollectionCommand(
        id,
        deleteMode,
        user?.id,
        user?.role === 'admin',
      ),
    );
  }
}
