import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReloadPluginsResponse } from '@delve/shared';
import { loadPlugins, PluginRegistry } from '@delve/core';
import { ReloadPluginsCommand } from './reload-plugins.command.js';
import { PLUGIN_REGISTRY } from '../plugins.providers.js';
import { ConfigStore } from '../../config/config.store.js';

@CommandHandler(ReloadPluginsCommand)
export class ReloadPluginsHandler
  implements ICommandHandler<ReloadPluginsCommand>
{
  private readonly logger = new Logger(ReloadPluginsHandler.name);

  constructor(
    @Inject(PLUGIN_REGISTRY) private readonly registry: PluginRegistry,
    private readonly configStore: ConfigStore,
    private readonly configService: ConfigService,
  ) {}

  async execute(_command: ReloadPluginsCommand): Promise<ReloadPluginsResponse> {
    const appConfig = this.configStore.get();
    // Fall back to the PLUGINS_DIR env var if the appConfig value is empty.
    const pluginsDir =
      appConfig.pluginsDir ||
      (this.configService.get<string>('PLUGINS_DIR') ?? '');

    this.logger.log(
      pluginsDir
        ? `Reloading plugins from "${pluginsDir}"`
        : 'No plugins directory configured — clearing registry',
    );

    this.registry.unregisterAll();

    if (!pluginsDir) {
      return { loaded: 0 };
    }

    const plugins = await loadPlugins(pluginsDir);
    for (const plugin of plugins) {
      this.registry.register(plugin);
      this.logger.log(
        `Loaded plugin "${plugin.name}" v${plugin.version}`,
      );
    }

    this.logger.log(`Plugin reload complete: ${plugins.length} plugin(s) loaded`);
    return { loaded: plugins.length };
  }
}
