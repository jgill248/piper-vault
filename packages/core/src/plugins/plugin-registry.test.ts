import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from './plugin-registry.js';
import type { DelvePlugin, FileParser } from '../index.js';

function makeParser(types: string[]): FileParser {
  return {
    supportedTypes: types,
    parse: async () => ({ ok: true, value: { text: 'test', metadata: {} } }),
  };
}

function makePlugin(
  name: string,
  mimeTypes: string[],
  version = '1.0.0',
): DelvePlugin {
  return {
    name,
    version,
    description: `Test plugin: ${name}`,
    parsers: [{ mimeTypes, parser: makeParser(mimeTypes) }],
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('adds a plugin to the registry', () => {
      const plugin = makePlugin('test-plugin', ['text/test']);
      registry.register(plugin);
      expect(registry.listPlugins()).toHaveLength(1);
      expect(registry.listPlugins()[0]?.name).toBe('test-plugin');
    });

    it('replaces an existing plugin with the same name on re-registration', () => {
      registry.register(makePlugin('same-name', ['text/v1'], '1.0.0'));
      registry.register(makePlugin('same-name', ['text/v2'], '2.0.0'));
      const plugins = registry.listPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.version).toBe('2.0.0');
      expect(plugins[0]?.supportedTypes).toContain('text/v2');
    });

    it('allows multiple plugins with different names', () => {
      registry.register(makePlugin('plugin-a', ['text/a']));
      registry.register(makePlugin('plugin-b', ['text/b']));
      expect(registry.listPlugins()).toHaveLength(2);
    });
  });

  describe('unregisterAll', () => {
    it('removes all registered plugins', () => {
      registry.register(makePlugin('plugin-a', ['text/a']));
      registry.register(makePlugin('plugin-b', ['text/b']));
      registry.unregisterAll();
      expect(registry.listPlugins()).toHaveLength(0);
    });

    it('is a no-op on an empty registry', () => {
      expect(() => registry.unregisterAll()).not.toThrow();
    });
  });

  describe('getParser', () => {
    it('returns the parser for a registered MIME type', () => {
      const plugin = makePlugin('csv-plugin', ['text/csv-enhanced']);
      registry.register(plugin);
      const parser = registry.getParser('text/csv-enhanced');
      expect(parser).toBeDefined();
    });

    it('returns undefined for an unregistered MIME type', () => {
      registry.register(makePlugin('csv-plugin', ['text/csv-enhanced']));
      expect(registry.getParser('application/unknown')).toBeUndefined();
    });

    it('returns undefined when registry is empty', () => {
      expect(registry.getParser('text/plain')).toBeUndefined();
    });

    it('resolves parser from the first matching plugin', () => {
      const parserA = makeParser(['text/overlap']);
      const parserB = makeParser(['text/overlap']);
      registry.register({ name: 'plugin-a', version: '1.0.0', parsers: [{ mimeTypes: ['text/overlap'], parser: parserA }] });
      registry.register({ name: 'plugin-b', version: '1.0.0', parsers: [{ mimeTypes: ['text/overlap'], parser: parserB }] });
      // plugin-a was registered first, so its parser wins
      expect(registry.getParser('text/overlap')).toBe(parserA);
    });
  });

  describe('listPlugins', () => {
    it('returns PluginInfo with flattened supportedTypes', () => {
      const plugin: DelvePlugin = {
        name: 'multi-type',
        version: '1.2.3',
        description: 'Handles multiple types',
        parsers: [
          { mimeTypes: ['text/a', 'text/b'], parser: makeParser(['text/a', 'text/b']) },
          { mimeTypes: ['text/c'], parser: makeParser(['text/c']) },
        ],
      };
      registry.register(plugin);
      const [info] = registry.listPlugins();
      expect(info?.supportedTypes).toEqual(['text/a', 'text/b', 'text/c']);
    });

    it('returns empty supportedTypes for a plugin without parsers', () => {
      registry.register({ name: 'hook-only', version: '0.1.0' });
      const [info] = registry.listPlugins();
      expect(info?.supportedTypes).toEqual([]);
    });

    it('returns an empty array when no plugins are registered', () => {
      expect(registry.listPlugins()).toEqual([]);
    });
  });
});
