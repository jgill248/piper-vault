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
        <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest animate-pulse">
          LOADING_PROVIDERS...
        </span>
      </div>
    );
  }

  const statusMap = new Map<LlmProviderName, LlmProviderStatus>();
  for (const p of providers) {
    statusMap.set(p.provider, p);
  }

  // Determine which provider + field had the last mutation error
  const errorProvider = updateMutation.isError ? updateMutation.variables?.provider : undefined;
  const errorField = updateMutation.isError && updateMutation.variables?.settings.baseUrl !== undefined
    ? 'baseUrl' as const
    : updateMutation.isError && updateMutation.variables?.settings.apiKey !== undefined
      ? 'apiKey' as const
      : undefined;

  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">
          PROVIDER_ENDPOINTS
        </span>
        <div className="flex-1 h-px bg-outline-variant/10" />
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
            urlError={errorProvider === provider && errorField === 'baseUrl'}
            keyError={errorProvider === provider && errorField === 'apiKey'}
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
  urlError: boolean;
  keyError: boolean;
}

function ProviderRow({
  provider,
  status,
  isExpanded,
  isActive,
  onToggle,
  onSave,
  isSaving,
  urlError,
  keyError: _keyError,
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
    <div className="border border-outline-variant/15 mb-1.5">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-outline-variant/5 transition-colors duration-100"
      >
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span
            className={`inline-block w-1.5 h-1.5 shrink-0 ${
              !needsCred || hasCredential ? 'bg-primary' : 'bg-on-surface-variant/40'
            }`}
          />
          <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
            {PROVIDER_LABELS[provider]}
          </span>
          {isActive && (
            <span className="font-label text-[8px] text-primary uppercase tracking-widest border border-primary/30 px-1.5 py-0.5">
              ACTIVE
            </span>
          )}
        </div>
        <span className="font-label text-[10px] text-on-surface-variant">
          {isExpanded ? '[-]' : '[+]'}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-outline-variant/10">
          {/* Base URL */}
          <div className="pt-2.5 pb-2 border-b border-outline-variant/10">
            <label className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
              BASE_URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                className={`flex-1 bg-surface-container border-b font-label text-[11px] text-primary px-2 py-0.5 outline-none transition-colors duration-100 ${
                  urlError
                    ? 'border-red-400/70 focus:border-red-400'
                    : 'border-outline-variant focus:border-primary'
                }`}
              />
              <button
                onClick={handleSaveUrl}
                disabled={isSaving}
                className="font-label text-[9px] text-primary uppercase tracking-wider border border-primary/30 px-2 py-0.5 hover:bg-primary/5 transition-all duration-100 disabled:opacity-40"
              >
                SET
              </button>
              <button
                onClick={handleResetUrl}
                disabled={isSaving}
                className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider border border-outline-variant/30 px-2 py-0.5 hover:border-primary/30 hover:text-primary transition-all duration-100 disabled:opacity-40"
              >
                DEFAULT
              </button>
            </div>
            {urlError && (
              <p className="font-label text-[9px] text-red-400/80 mt-1">
                INVALID_URL — must be a valid http/https address
              </p>
            )}
          </div>

          {/* API Key / Token (not shown for Ollama) */}
          {needsCred && (
            <div className="pt-2.5">
              <label className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest block mb-1">
                {CREDENTIAL_LABELS[provider] ?? 'API_KEY'}
              </label>

              {/* Current status */}
              {hasCredential && !keyTouched && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-label text-[10px] text-secondary">
                    {status?.credentialHint || '••••••••'}
                  </span>
                  <span className="font-label text-[8px] text-primary/60 uppercase">configured</span>
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
                  className="flex-1 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-0.5 outline-none focus:border-primary transition-colors duration-100 placeholder:text-on-surface-variant/40"
                />
                <button
                  onClick={handleSaveKey}
                  disabled={isSaving || !keyDraft}
                  className="font-label text-[9px] text-primary uppercase tracking-wider border border-primary/30 px-2 py-0.5 hover:bg-primary/5 transition-all duration-100 disabled:opacity-40"
                >
                  SAVE
                </button>
                {hasCredential && (
                  <button
                    onClick={handleClearKey}
                    disabled={isSaving}
                    className="font-label text-[9px] text-red-400/70 uppercase tracking-wider border border-red-400/20 px-2 py-0.5 hover:border-red-400/40 hover:text-red-400 transition-all duration-100 disabled:opacity-40"
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
