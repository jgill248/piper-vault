import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { PluginInfo, ReloadPluginsResponse } from '@delve/shared';
import { ListPluginsQuery } from './queries/list-plugins.query.js';
import { ReloadPluginsCommand } from './commands/reload-plugins.command.js';

@Controller('plugins')
export class PluginsController {
  private readonly logger = new Logger(PluginsController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /api/v1/plugins
   * Returns the list of currently loaded plugins and their supported MIME types.
   */
  @Get()
  async list(): Promise<readonly PluginInfo[]> {
    return this.queryBus.execute<ListPluginsQuery, readonly PluginInfo[]>(
      new ListPluginsQuery(),
    );
  }

  /**
   * POST /api/v1/plugins/reload
   * Re-scans the configured plugin directory and reloads all plugins.
   * Returns how many plugins were loaded.
   */
  @Post('reload')
  @HttpCode(HttpStatus.OK)
  async reload(): Promise<ReloadPluginsResponse> {
    this.logger.log('Received plugin reload request');
    return this.commandBus.execute<ReloadPluginsCommand, ReloadPluginsResponse>(
      new ReloadPluginsCommand(),
    );
  }
}
