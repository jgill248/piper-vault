import { useState } from 'react';
import { LLM_PROVIDERS, DEFAULT_PROVIDER_URLS } from '@delve/shared';
import type { LlmProviderName, LlmProviderStatus } from '@delve/shared';
import { useProviderSettings, useUpdateProviderSettings } from '../../hooks/use-provider-settings';

const PROVIDER_LABELS: Record<LlmProviderName, string> = {
  'ask-sage': 'ASK_SAGE',
  'anthropic': 'ANTHROPIC',
  'openai': 'OPENAI',
  'ollama': 'OLLAMA',
};

const NEEDS_CREDENTIAL: Record<LlmProviderName, boolean> = {
  'ask-sage': true,
  'anthropic': true,
  'openai': true,
  'ollama': false,
};

const CREDENTIAL_LABELS: Record<string, string> = {
  'ask-sage': 'ACCESS_TOKEN',
  'anthropic': 'API_KEY',
  'openai': 'API_KEY',
};

interface ProviderSettingsSectionProps {
  activeProvider: LlmProviderName;
}

export function ProviderSettingsSection({ activeProvider }: ProviderSettingsSectionProps) {
  const { data: providers, isLoading } = useProviderSettings();
  const updateMutation = useUpdateProviderSettings();
  const [expanded, setExpanded] = useState<LlmProviderName | null>(null);

  // Active provider is expanded by default
  const expandedProvider = expanded ?? activeProvider;

  if (isLoading || !providers) {
    return (
      <div className="py-2">
        <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest animate-pulse">
          LOADING_PROVIDERS...
        </span>
      </div>
    );
  }

  const statusMap = new Map<LlmProviderName, LlmProviderStatus>();
  for (const p of providers) {
    statusMap.set(p.provider, p);
  }

  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[9px] text-ui-dim uppercase tracking-wider">
          PROVIDER_ENDPOINTS
        </span>
        <div className="flex-1 h-px bg-obsidian-border/10" />
      </div>

      {LLM_PROVIDERS.map((provider) => {
        const status = statusMap.get(provider);
        const isExpanded = expandedProvider === provider;
        const isActive = provider === activeProvider;

        return (
          <ProviderRow
            key={provider}
            provider={provider}
            status={status}
            isExpanded={isExpanded}
            isActive={isActive}
            onToggle={() => setExpanded(isExpanded ? null : provider)}
            onSave={(settings) => {
              updateMutation.mutate({ provider, settings });
            }}
            isSaving={updateMutation.isPending}
          />
        );
      })}
    </div>
  );
}

interface ProviderRowProps {
  provider: LlmProviderName;
  status: LlmProviderStatus | undefined;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onSave: (settings: { baseUrl?: string; apiKey?: string }) => void;
  isSaving: boolean;
}

function ProviderRow({
  provider,
  status,
  isExpanded,
  isActive,
  onToggle,
  onSave,
  isSaving,
}: ProviderRowProps) {
  const [urlDraft, setUrlDraft] = useState(status?.baseUrl ?? DEFAULT_PROVIDER_URLS[provider]);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  const needsCred = NEEDS_CREDENTIAL[provider];
  const hasCredential = status?.hasCredential ?? false;

  function handleSaveUrl() {
    const defaultUrl = DEFAULT_PROVIDER_URLS[provider];
    // Send empty string to clear the override (revert to default)
    onSave({ baseUrl: urlDraft === defaultUrl ? '' : urlDraft });
  }

  function handleSaveKey() {
    onSave({ apiKey: keyDraft });
    setKeyDraft('');
    setKeyTouched(false);
  }

  function handleClearKey() {
    onSave({ apiKey: '' });
    setKeyDraft('');
    setKeyTouched(false);
  }

  function handleResetUrl() {
    const defaultUrl = DEFAULT_PROVIDER_URLS[provider];
    setUrlDraft(defaultUrl);
    onSave({ baseUrl: '' });
  }

  return (
    <div className="border border-obsidian-border/15 mb-1.5">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-obsidian-border/5 transition-colors duration-100"
      >
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span
            className={`inline-block w-1.5 h-1.5 shrink-0 ${
              !needsCred || hasCredential ? 'bg-phosphor' : 'bg-ui-dim/40'
            }`}
          />
          <span className="font-mono text-[10px] text-ui-muted uppercase tracking-wider">
            {PROVIDER_LABELS[provider]}
          </span>
          {isActive && (
            <span className="font-mono text-[8px] text-phosphor uppercase tracking-widest border border-phosphor/30 px-1.5 py-0.5">
              ACTIVE
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-ui-dim">
          {isExpanded ? '[-]' : '[+]'}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-obsidian-border/10">
          {/* Base URL */}
          <div className="pt-2.5 pb-2 border-b border-obsidian-border/10">
            <label className="font-mono text-[9px] text-ui-dim uppercase tracking-widest block mb-1">
              BASE_URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                className="flex-1 bg-obsidian-sunken border-b border-obsidian-border font-mono text-[11px] text-phosphor px-2 py-0.5 outline-none focus:border-phosphor transition-colors duration-100"
              />
              <button
                onClick={handleSaveUrl}
                disabled={isSaving}
                className="font-mono text-[9px] text-phosphor uppercase tracking-wider border border-phosphor/30 px-2 py-0.5 hover:bg-phosphor/5 transition-all duration-100 disabled:opacity-40"
              >
                SET
              </button>
              <button
                onClick={handleResetUrl}
                disabled={isSaving}
                className="font-mono text-[9px] text-ui-dim uppercase tracking-wider border border-obsidian-border/30 px-2 py-0.5 hover:border-phosphor/30 hover:text-phosphor transition-all duration-100 disabled:opacity-40"
              >
                DEFAULT
              </button>
            </div>
          </div>

          {/* API Key / Token (not shown for Ollama) */}
          {needsCred && (
            <div className="pt-2.5">
              <label className="font-mono text-[9px] text-ui-dim uppercase tracking-widest block mb-1">
                {CREDENTIAL_LABELS[provider] ?? 'API_KEY'}
              </label>

              {/* Current status */}
              {hasCredential && !keyTouched && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] text-ui-muted">
                    {status?.credentialHint || '••••••••'}
                  </span>
                  <span className="font-mono text-[8px] text-phosphor/60 uppercase">configured</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => {
                    setKeyDraft(e.target.value);
                    setKeyTouched(true);
                  }}
                  placeholder={hasCredential ? 'Enter new key to replace' : 'Enter API key'}
                  className="flex-1 bg-obsidian-sunken border-b border-obsidian-border font-mono text-[11px] text-phosphor px-2 py-0.5 outline-none focus:border-phosphor transition-colors duration-100 placeholder:text-ui-dim/40"
                />
                <button
                  onClick={handleSaveKey}
                  disabled={isSaving || !keyDraft}
                  className="font-mono text-[9px] text-phosphor uppercase tracking-wider border border-phosphor/30 px-2 py-0.5 hover:bg-phosphor/5 transition-all duration-100 disabled:opacity-40"
                >
                  SAVE
                </button>
                {hasCredential && (
                  <button
                    onClick={handleClearKey}
                    disabled={isSaving}
                    className="font-mono text-[9px] text-red-400/70 uppercase tracking-wider border border-red-400/20 px-2 py-0.5 hover:border-red-400/40 hover:text-red-400 transition-all duration-100 disabled:opacity-40"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
