import type { FileParser } from '../ingestion/parser.js';
import type { DelvePlugin, PluginInfo } from './plugin.js';

/**
 * PluginRegistry holds all registered plugins and provides parser resolution.
 *
 * Parser lookup priority: plugin parsers are checked first (in registration
 * order), then the caller falls back to built-in parsers. This allows plugins
 * to override built-in behaviour for any MIME type.
 *
 * The registry is designed to be injected as a singleton in the NestJS DI
 * container and shared across the ingestion pipeline.
 */
export class PluginRegistry {
  private readonly plugins: DelvePlugin[] = [];

  /**
   * Registers a plugin. If a plugin with the same name is already registered,
   * the new registration replaces the old one (allows hot-reload via
   * ReloadPluginsCommand).
   */
  register(plugin: DelvePlugin): void {
    const existingIndex = this.plugins.findIndex((p) => p.name === plugin.name);
    if (existingIndex !== -1) {
      this.plugins.splice(existingIndex, 1, plugin);
    } else {
      this.plugins.push(plugin);
    }
  }

  /**
   * Removes all registered plugins. Used by the reload command to start fresh
   * before re-scanning the plugin directory.
   */
  unregisterAll(): void {
    this.plugins.length = 0;
  }

  /**
   * Returns the first plugin-contributed parser that supports the given MIME
   * type, or undefined if none is found. The ingestion pipeline falls back to
   * built-in parsers when this returns undefined.
   */
  getParser(mimeType: string): FileParser | undefined {
    for (const plugin of this.plugins) {
      if (!plugin.parsers) continue;
      for (const pp of plugin.parsers) {
        if (pp.mimeTypes.includes(mimeType)) {
          return pp.parser;
        }
      }
    }
    return undefined;
  }

  /**
   * Returns a read-only summary of every registered plugin, safe to send over
   * the API. Flattens each plugin's supported MIME types into a single list.
   */
  listPlugins(): readonly PluginInfo[] {
    return this.plugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      supportedTypes: (plugin.parsers ?? []).flatMap((pp) => [...pp.mimeTypes]),
    }));
  }
}
