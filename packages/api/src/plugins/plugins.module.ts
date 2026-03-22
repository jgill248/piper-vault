import { Module, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import { PluginRegistry, loadPlugins } from '@delve/core';
import { PluginsController } from './plugins.controller.js';
import { ListPluginsHandler } from './queries/list-plugins.handler.js';
import { ReloadPluginsHandler } from './commands/reload-plugins.handler.js';
import { PLUGIN_REGISTRY } from './plugins.providers.js';
import { ConfigStore } from '../config/config.store.js';

const QueryHandlers = [ListPluginsHandler];
const CommandHandlers = [ReloadPluginsHandler];

/**
 * Provides the shared PluginRegistry singleton that is also injected into
 * CoreProvidersModule's ingestion pipeline factory.
 */
const pluginRegistryProvider: Provider = {
  provide: PLUGIN_REGISTRY,
  useValue: new PluginRegistry(),
};

@Module({
  imports: [CqrsModule],
  controllers: [PluginsController],
  providers: [pluginRegistryProvider, ...QueryHandlers, ...CommandHandlers],
  exports: [PLUGIN_REGISTRY],
})
export class PluginsModule implements OnModuleInit {
  private readonly logger = new Logger(PluginsModule.name);

  constructor(
    @Inject(PLUGIN_REGISTRY) private readonly registry: PluginRegistry,
    private readonly configStore: ConfigStore,
    private readonly configService: ConfigService,
  ) {}

  /**
   * On application startup, load plugins from the configured directory.
   * Errors in individual plugin files are handled gracefully by loadPlugins.
   */
  async onModuleInit(): Promise<void> {
    const appConfig = this.configStore.get();
    const pluginsDir =
      appConfig.pluginsDir ||
      (this.configService.get<string>('PLUGINS_DIR') ?? '');

    if (!pluginsDir) {
      this.logger.log(
        'No plugins directory configured (set pluginsDir in config or PLUGINS_DIR env var). Plugin system ready but empty.',
      );
      return;
    }

    this.logger.log(`Loading plugins from "${pluginsDir}"`);
    const plugins = await loadPlugins(pluginsDir);
    for (const plugin of plugins) {
      this.registry.register(plugin);
      this.logger.log(`Loaded plugin "${plugin.name}" v${plugin.version}`);
    }
    this.logger.log(`Plugin system initialized: ${plugins.length} plugin(s) loaded`);
  }
}
