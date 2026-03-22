import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import type { PluginInfo } from '@delve/shared';
import { ListPluginsQuery } from './list-plugins.query.js';
import { PLUGIN_REGISTRY } from '../plugins.providers.js';
import type { PluginRegistry } from '@delve/core';

@QueryHandler(ListPluginsQuery)
export class ListPluginsHandler implements IQueryHandler<ListPluginsQuery> {
  constructor(
    @Inject(PLUGIN_REGISTRY) private readonly registry: PluginRegistry,
  ) {}

  execute(_query: ListPluginsQuery): Promise<readonly PluginInfo[]> {
    return Promise.resolve(this.registry.listPlugins() as PluginInfo[]);
  }
}
