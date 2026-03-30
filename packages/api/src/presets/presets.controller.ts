import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { SystemPromptPreset } from '@delve/shared';
import { CreatePresetCommand } from './commands/create-preset.command';
import { UpdatePresetCommand } from './commands/update-preset.command';
import { DeletePresetCommand } from './commands/delete-preset.command';
import { ListPresetsQuery } from './queries/list-presets.query';
import { GetPresetQuery } from './queries/get-preset.query';
import {
  CreatePresetSchema,
  UpdatePresetSchema,
} from './dto/create-preset.dto';

@Controller('presets')
export class PresetsController {
  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<SystemPromptPreset> {
    const parsed = CreatePresetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { name, persona, model } = parsed.data;
    return this.commandBus.execute(
      new CreatePresetCommand(name, persona, model),
    );
  }

  @Get()
  async list(): Promise<SystemPromptPreset[]> {
    return this.queryBus.execute(new ListPresetsQuery());
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<SystemPromptPreset> {
    return this.queryBus.execute(new GetPresetQuery(id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SystemPromptPreset> {
    const parsed = UpdatePresetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
    }

    const { name, persona, model } = parsed.data;
    return this.commandBus.execute(
      new UpdatePresetCommand(id, name, persona, model),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new DeletePresetCommand(id));
  }
}
