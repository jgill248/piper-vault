import type { PluginInfo } from '@delve/shared';
import { usePlugins, useReloadPlugins } from '../../hooks/use-plugins';

/**
 * A single row showing one installed plugin's details.
 */
function PluginRow({ plugin }: { plugin: PluginInfo }) {
  return (
    <div className="py-2.5 border-b border-outline-variant/10 last:border-0">
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-label text-[11px] text-primary">{plugin.name}</span>
        <span className="font-label text-[9px] text-on-surface-variant tabular-nums">
          v{plugin.version}
        </span>
      </div>
      {plugin.description && (
        <p className="font-body text-[10px] text-on-surface-variant leading-relaxed mb-1">
          {plugin.description}
        </p>
      )}
      {plugin.supportedTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {plugin.supportedTypes.map((type) => (
            <span
              key={type}
              className="font-label text-[9px] text-secondary border border-outline-variant/30 px-1.5 py-0.5 uppercase tracking-wide"
            >
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Plugins section for the settings page.
 *
 * Shows all currently loaded plugins and provides a "Reload Plugins" action.
 * Follows the Sovereign Press design system: no rounded corners, label font
 * for data labels, primary accent for the CTA.
 */
export function PluginsPanel() {
  const { data: plugins, isLoading, isError } = usePlugins();
  const reload = useReloadPlugins();

  function handleReload() {
    reload.mutate();
  }

  const isEmpty = !isLoading && !isError && (plugins?.length ?? 0) === 0;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3" id="section-plugins">
        <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
          PLUGIN_SYSTEM
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
        <button
          onClick={handleReload}
          disabled={reload.isPending}
          aria-label="Reload plugins from directory"
          className="btn-secondary text-[9px] px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {reload.isPending ? 'RELOADING...' : 'RELOAD_PLUGINS_'}
        </button>
      </div>

      {/* Status indicator row */}
      {reload.isSuccess && (
        <p className="font-label text-[9px] text-primary uppercase tracking-widest mb-2 animate-pulse">
          RELOAD_COMPLETE — {reload.data.loaded} PLUGIN(S) LOADED
        </p>
      )}
      {reload.isError && (
        <p className="font-label text-[9px] text-red-400 uppercase tracking-widest mb-2">
          RELOAD_FAILED
        </p>
      )}

      {/* Plugin list */}
      <div className="bg-surface-container border border-outline-variant/20 px-3">
        {isLoading && (
          <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest py-4 text-center animate-pulse">
            LOADING...
          </p>
        )}
        {isError && (
          <p className="font-label text-[10px] text-red-400 uppercase tracking-widest py-4 text-center">
            FAILED_TO_LOAD_PLUGINS
          </p>
        )}
        {isEmpty && (
          <div className="py-6 text-center">
            <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              NO_PLUGINS_INSTALLED
            </p>
            <p className="font-body text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
              Place <span className="font-label text-secondary">.js</span> plugin files in your plugins
              directory, then click <span className="font-label text-secondary">RELOAD_PLUGINS_</span>.
            </p>
          </div>
        )}
        {!isLoading &&
          !isError &&
          plugins?.map((plugin) => (
            <PluginRow key={plugin.name} plugin={plugin} />
          ))}
      </div>
    </div>
  );
}
