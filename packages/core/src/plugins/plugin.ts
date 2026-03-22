import type { FileParser } from '../ingestion/parser.js';

/**
 * A single parser contributed by a plugin, binding MIME types to a FileParser
 * implementation. The plugin system checks these before falling back to the
 * built-in parsers so third-party plugins can override built-ins if needed.
 */
export interface PluginParser {
  readonly mimeTypes: readonly string[];
  readonly parser: FileParser;
}

/**
 * The contract that every Delve plugin must satisfy.
 * Plugin files loaded from the plugins directory must export a default value
 * (or module.exports) that conforms to this interface.
 */
export interface DelvePlugin {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly parsers?: readonly PluginParser[];
  // Reserved for future extensibility: hooks, transforms, post-processors, etc.
}

/**
 * Read-only summary of a loaded plugin, safe to expose over the API.
 */
export interface PluginInfo {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly supportedTypes: readonly string[];
}
