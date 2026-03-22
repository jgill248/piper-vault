import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginRegistry } from '@delve/core';
import type { DelvePlugin } from '@delve/core';
import { ReloadPluginsHandler } from './reload-plugins.handler.js';
import { ReloadPluginsCommand } from './reload-plugins.command.js';
import type { ConfigStore } from '../../config/config.store.js';
import { DEFAULT_CONFIG } from '@delve/shared';

// We mock @delve/core loadPlugins at the module level to avoid filesystem access.
vi.mock('@delve/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@delve/core')>();
  return {
    ...original,
    loadPlugins: vi.fn().mockResolvedValue([]),
  };
});

import { loadPlugins } from '@delve/core';

function makeConfigStore(pluginsDir = ''): ConfigStore {
  return {
    get: vi.fn().mockReturnValue({ ...DEFAULT_CONFIG, pluginsDir }),
    update: vi.fn(),
  } as unknown as ConfigStore;
}

function makeConfigService(pluginsDir = '') {
  return {
    get: vi.fn().mockReturnValue(pluginsDir),
  };
}

function makePlugin(name: string): DelvePlugin {
  return { name, version: '1.0.0' };
}

describe('ReloadPluginsHandler', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    vi.mocked(loadPlugins).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loaded: 0 when no plugins directory is configured', async () => {
    const handler = new ReloadPluginsHandler(
      registry,
      makeConfigStore(''),
      makeConfigService('') as never,
    );

    const result = await handler.execute(new ReloadPluginsCommand());

    expect(result).toEqual({ loaded: 0 });
    expect(loadPlugins).not.toHaveBeenCalled();
  });

  it('calls loadPlugins with the configured directory and registers plugins', async () => {
    vi.mocked(loadPlugins).mockResolvedValue([
      makePlugin('plugin-a'),
      makePlugin('plugin-b'),
    ]);

    const handler = new ReloadPluginsHandler(
      registry,
      makeConfigStore('/home/user/.delve/plugins'),
      makeConfigService() as never,
    );

    const result = await handler.execute(new ReloadPluginsCommand());

    expect(result).toEqual({ loaded: 2 });
    expect(loadPlugins).toHaveBeenCalledWith('/home/user/.delve/plugins');
    expect(registry.listPlugins()).toHaveLength(2);
  });

  it('clears the registry before loading new plugins', async () => {
    // Pre-populate the registry
    registry.register(makePlugin('old-plugin'));

    vi.mocked(loadPlugins).mockResolvedValue([makePlugin('new-plugin')]);

    const handler = new ReloadPluginsHandler(
      registry,
      makeConfigStore('/some/dir'),
      makeConfigService() as never,
    );

    await handler.execute(new ReloadPluginsCommand());

    const pluginNames = registry.listPlugins().map((p) => p.name);
    expect(pluginNames).not.toContain('old-plugin');
    expect(pluginNames).toContain('new-plugin');
  });

  it('falls back to PLUGINS_DIR env var when appConfig.pluginsDir is empty', async () => {
    vi.mocked(loadPlugins).mockResolvedValue([]);

    const handler = new ReloadPluginsHandler(
      registry,
      makeConfigStore(''),
      makeConfigService('/env/plugins') as never,
    );

    await handler.execute(new ReloadPluginsCommand());

    expect(loadPlugins).toHaveBeenCalledWith('/env/plugins');
  });
});
