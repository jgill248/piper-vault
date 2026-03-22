import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '@delve/core';
import type { DelvePlugin } from '@delve/core';
import { ListPluginsHandler } from './list-plugins.handler.js';
import { ListPluginsQuery } from './list-plugins.query.js';

function makePlugin(name: string, types: string[]): DelvePlugin {
  return {
    name,
    version: '1.0.0',
    description: `Plugin ${name}`,
    parsers: [
      {
        mimeTypes: types,
        parser: {
          supportedTypes: types,
          parse: async () => ({ ok: true, value: { text: '', metadata: {} } }),
        },
      },
    ],
  };
}

describe('ListPluginsHandler', () => {
  let registry: PluginRegistry;
  let handler: ListPluginsHandler;

  beforeEach(() => {
    registry = new PluginRegistry();
    handler = new ListPluginsHandler(registry);
  });

  it('returns an empty array when no plugins are registered', async () => {
    const result = await handler.execute(new ListPluginsQuery());
    expect(result).toEqual([]);
  });

  it('returns info for all registered plugins', async () => {
    registry.register(makePlugin('plugin-a', ['text/a']));
    registry.register(makePlugin('plugin-b', ['text/b', 'text/c']));

    const result = await handler.execute(new ListPluginsQuery());

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('plugin-a');
    expect(result[0]?.supportedTypes).toContain('text/a');
    expect(result[1]?.name).toBe('plugin-b');
    expect(result[1]?.supportedTypes).toContain('text/b');
  });
});
