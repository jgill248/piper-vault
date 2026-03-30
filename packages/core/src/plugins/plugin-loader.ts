import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { DelvePlugin } from './plugin.js';

/**
 * Attempts to load a single plugin file via dynamic import.
 *
 * Supports both ES module default exports and CommonJS module.exports. Logs a
 * warning and returns undefined if the file does not export a valid plugin
 * shape, so bad plugins never crash the application.
 */
async function loadPluginFile(filePath: string): Promise<DelvePlugin | undefined> {
  try {
    const mod: unknown = await import(filePath);
    // Support both `export default` (ESM) and `module.exports = ...` (CJS).
    const exported: unknown = (mod as { default?: unknown }).default ?? mod;

    if (!isDelvePlugin(exported)) {
      console.warn(
        `[PluginLoader] Skipping "${filePath}": default export does not conform to DelvePlugin interface (must have name and version strings).`,
      );
      return undefined;
    }

    return exported;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[PluginLoader] Failed to load plugin at "${filePath}": ${message}`);
    return undefined;
  }
}

/**
 * Type guard for the DelvePlugin interface.
 * Only checks the required fields; optional fields are not validated here.
 */
function isDelvePlugin(value: unknown): value is DelvePlugin {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['name'] === 'string' && typeof obj['version'] === 'string';
}

/**
 * Scans `pluginsDir` for `.js` files and attempts to load each one as a
 * DelvePlugin. Files that fail to load or do not export a valid plugin shape
 * are skipped with a warning. Missing or unreadable directories are handled
 * gracefully — an empty array is returned.
 *
 * @param pluginsDir Absolute path to the directory containing plugin files.
 *   Defaults to `~/.delve/plugins/` if not provided.
 */
export async function loadPlugins(
  pluginsDir: string = defaultPluginsDir(),
): Promise<readonly DelvePlugin[]> {
  if (!pluginsDir) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(pluginsDir);
  } catch {
    // Directory does not exist or is not readable — not an error condition.
    return [];
  }

  const jsFiles = entries.filter((entry) => entry.endsWith('.js'));

  if (jsFiles.length === 0) {
    return [];
  }

  const results = await Promise.all(
    jsFiles.map((file) => {
      const absolutePath = resolve(join(pluginsDir, file));
      return loadPluginFile(absolutePath);
    }),
  );

  return results.filter((p): p is DelvePlugin => p !== undefined);
}

/**
 * Returns the platform-appropriate default plugins directory.
 * Uses the HOME environment variable; falls back to the process working
 * directory if HOME is undefined (e.g., in some CI environments).
 */
function defaultPluginsDir(): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? process.cwd();
  return join(home, '.delve', 'plugins');
}
