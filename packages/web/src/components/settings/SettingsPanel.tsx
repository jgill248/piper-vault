import { useState, useEffect } from 'react';
import { DEFAULT_CONFIG, LLM_PROVIDERS } from '@delve/shared';
import type { AppConfig } from '@delve/shared';
import { useConfig, useUpdateConfig, useModels } from '../../hooks/use-config';
import { useTheme } from '../../hooks/use-theme';
import { PluginsPanel } from './PluginsPanel';
import { ApiKeysSection } from './ApiKeysSection';
import { WatchedFoldersSection } from './WatchedFoldersSection';
import { ProviderSettingsSection } from './ProviderSettingsSection';
import { PresetsSection } from './PresetsSection';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  index?: string; // kept for backwards compat but not rendered
}

function Section({ title, children }: SectionProps) {
  const sectionId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="mb-6" id={`section-${sectionId}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
          {title}
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      <div className="bg-surface-container border border-outline-variant/20 px-3">
        {children}
      </div>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function FieldRow({ label, description, children }: FieldRowProps) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-outline-variant/10 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <label className="font-label text-[10px] text-secondary uppercase tracking-widest block">
          {label}
        </label>
        {description && (
          <p className="font-body text-[10px] text-on-surface-variant mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}

function NumberInput({ value, onChange, min, max, unit }: NumberInputProps) {
  return (
    <div className="flex items-baseline gap-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary text-right px-2 py-0.5 outline-none focus:border-primary transition-colors duration-100 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={unit ? `Value in ${unit}` : 'Value'}
      />
      {unit && (
        <span className="font-label text-[9px] text-on-surface-variant uppercase">{unit}</span>
      )}
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
}

function TextInput({ value, onChange }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-0.5 outline-none focus:border-primary transition-colors duration-100"
    />
  );
}

interface SelectInputProps {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}

function SelectInput({ value, onChange, options }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-0.5 outline-none focus:border-primary transition-colors duration-100 appearance-none cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-surface-container-high text-on-surface">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface ToggleInputProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

function ToggleInput({ value, onChange, label }: ToggleInputProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-label={label}
      className={`flex items-center gap-2 border px-3 py-1.5 font-label text-[10px] uppercase tracking-wider transition-all duration-150 ${
        value
          ? 'border-primary text-primary bg-primary/5'
          : 'border-outline-variant text-secondary hover:border-primary hover:text-primary'
      }`}
    >
      <span
        className={`inline-block w-3 h-3 border shrink-0 transition-all duration-150 ${
          value ? 'bg-primary-container border-primary' : 'bg-transparent border-outline-variant'
        }`}
        aria-hidden="true"
      />
      {value ? 'ENABLED' : 'DISABLED'}
    </button>
  );
}

interface SliderInputProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

function SliderInput({ value, onChange, min, max, step }: SliderInputProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-primary cursor-pointer"
        aria-label="Similarity threshold"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <span className="font-label text-[11px] text-primary tabular-nums w-10 text-right">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

interface ConfigEditorProps {
  draft: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

function ConfigEditor({ draft, onChange }: ConfigEditorProps) {
  const { data: modelsData } = useModels(draft.llmProvider);

  const modelOptions = (() => {
    const fetched = modelsData?.models ?? [];
    const current = draft.llmModel;
    const all = fetched.includes(current) ? fetched : [current, ...fetched];
    return all.map((m) => ({ value: m, label: m }));
  })();

  return (
    <>
      <Section index="01" title="LLM_CONFIGURATION">
        <FieldRow
          label="LLM_PROVIDER"
          description="Backend provider for language model queries"
        >
          <SelectInput
            value={draft.llmProvider}
            onChange={(v) => onChange({ llmProvider: v as AppConfig['llmProvider'] })}
            options={LLM_PROVIDERS.map(p => ({ value: p, label: p.toUpperCase().replace('-', '_') }))}
          />
        </FieldRow>
        <FieldRow
          label="LLM_MODEL"
          description="Language model used for answer generation"
        >
          <SelectInput
            value={draft.llmModel}
            onChange={(v) => onChange({ llmModel: v })}
            options={modelOptions}
          />
        </FieldRow>
        <FieldRow
          label="MAX_CONTEXT_TOKENS"
          description="Maximum tokens from retrieved context fed to the LLM"
        >
          <NumberInput
            value={draft.maxContextTokens}
            onChange={(v) => onChange({ maxContextTokens: v })}
            min={500}
            max={32000}
            unit="TOKENS"
          />
        </FieldRow>
        <FieldRow
          label="MAX_CONVERSATION_TURNS"
          description="Number of prior turns included in each prompt"
        >
          <NumberInput
            value={draft.maxConversationTurns}
            onChange={(v) => onChange({ maxConversationTurns: v })}
            min={1}
            max={50}
            unit="TURNS"
          />
        </FieldRow>
        <ProviderSettingsSection activeProvider={draft.llmProvider} />
      </Section>

      <Section index="02" title="EMBEDDING_CONFIGURATION">
        <FieldRow
          label="EMBEDDING_MODEL"
          description="Sentence transformer model for vector embedding generation (read-only)"
        >
          <span className="font-label text-[11px] text-secondary tabular-nums">
            {draft.embeddingModel}
          </span>
        </FieldRow>
      </Section>

      <Section index="03" title="CHUNKING_STRATEGY">
        <FieldRow
          label="CHUNK_SIZE"
          description="Target token count per document chunk"
        >
          <NumberInput
            value={draft.chunkSize}
            onChange={(v) => onChange({ chunkSize: v })}
            min={128}
            max={2048}
            unit="TOKENS"
          />
        </FieldRow>
        <FieldRow
          label="CHUNK_OVERLAP"
          description="Sliding window overlap between consecutive chunks"
        >
          <NumberInput
            value={draft.chunkOverlap}
            onChange={(v) => onChange({ chunkOverlap: v })}
            min={0}
            max={draft.chunkSize - 1}
            unit="TOKENS"
          />
        </FieldRow>
      </Section>

      <Section index="04" title="RETRIEVAL_PARAMETERS">
        <FieldRow
          label="TOP_K_RESULTS"
          description="Number of vector-similar chunks retrieved per query"
        >
          <NumberInput
            value={draft.topKResults}
            onChange={(v) => onChange({ topKResults: v })}
            min={1}
            max={50}
            unit="CHUNKS"
          />
        </FieldRow>
        <FieldRow
          label="SIMILARITY_THRESHOLD"
          description="Minimum cosine similarity score for chunk inclusion"
        >
          <SliderInput
            value={draft.similarityThreshold}
            onChange={(v) => onChange({ similarityThreshold: v })}
            min={0}
            max={1}
            step={0.01}
          />
        </FieldRow>
      </Section>

      <Section index="05" title="RETRIEVAL_INTELLIGENCE">
        <FieldRow
          label="HYBRID_SEARCH"
          description="Combine vector similarity with keyword (BM25) scoring"
        >
          <ToggleInput
            value={draft.hybridSearchEnabled}
            onChange={(v) => onChange({ hybridSearchEnabled: v })}
            label="Toggle hybrid search"
          />
        </FieldRow>
        {draft.hybridSearchEnabled && (
          <FieldRow
            label="HYBRID_WEIGHT"
            description="Balance between vector (1.0) and keyword (0.0) results"
          >
            <SliderInput
              value={draft.hybridSearchWeight}
              onChange={(v) => onChange({ hybridSearchWeight: v })}
              min={0}
              max={1}
              step={0.05}
            />
          </FieldRow>
        )}
        <FieldRow
          label="RE_RANKING"
          description="LLM-based re-ranking of retrieved chunks for better precision"
        >
          <ToggleInput
            value={draft.rerankEnabled}
            onChange={(v) => onChange({ rerankEnabled: v })}
            label="Toggle re-ranking"
          />
        </FieldRow>
        {draft.rerankEnabled && (
          <FieldRow
            label="RERANK_TOP_N"
            description="Number of chunks to keep after re-ranking"
          >
            <NumberInput
              value={draft.rerankTopN}
              onChange={(v) => onChange({ rerankTopN: v })}
              min={1}
              max={20}
              unit="CHUNKS"
            />
          </FieldRow>
        )}
        <FieldRow
          label="FOLLOW_UP_QUESTIONS"
          description="Generate suggested follow-up questions after each response"
        >
          <ToggleInput
            value={draft.followUpQuestionsEnabled}
            onChange={(v) => onChange({ followUpQuestionsEnabled: v })}
            label="Toggle follow-up questions"
          />
        </FieldRow>
      </Section>
    </>
  );
}

export function SettingsPanel() {
  const { data: config, isLoading, isError } = useConfig();
  const updateConfig = useUpdateConfig();
  const { theme, toggle: toggleTheme } = useTheme();

  const baseConfig = config ?? DEFAULT_CONFIG;
  const [draft, setDraft] = useState<AppConfig>(baseConfig);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Sync draft when server config loads
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time sync from server
  useEffect(() => { if (config) setDraft(config); }, [config]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(baseConfig);

  function handleChange(patch: Partial<AppConfig>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSaveStatus('idle');
  }

  function handleReset() {
    setDraft(baseConfig);
    setSaveStatus('idle');
  }

  function handleSave() {
    updateConfig.mutate(draft, {
      onSuccess: () => {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      },
      onError: () => {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      },
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 bg-surface shrink-0">
        <div>
          <h1 className="font-headline font-semibold text-on-surface text-sm">System Configuration</h1>
          <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mt-0.5">
            {isError ? 'DEFAULT_VALUES' : isLoading ? 'FETCHING...' : 'LIVE_VALUES'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 ${
              isError
                ? 'bg-yellow-400'
                : isLoading
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-primary'
            }`}
          />
          {saveStatus === 'success' && (
            <span className="font-label text-[9px] text-primary uppercase tracking-widest animate-pulse">
              SAVED
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="font-label text-[9px] text-red-400 uppercase tracking-widest">
              SAVE_FAILED
            </span>
          )}
        </div>
      </div>

      {/* Section jump nav */}
      {!isLoading && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant/20 bg-surface shrink-0 overflow-x-auto">
          {['LLM', 'PRESETS', 'EMBEDDING', 'CHUNKING', 'RETRIEVAL', 'INTELLIGENCE', 'SYSTEM', 'INTERFACE', 'AUTH', 'API_KEYS', 'FOLDERS', 'PLUGINS'].map((label) => (
            <button
              key={label}
              onClick={() => {
                const el = document.getElementById(`section-${label.toLowerCase().replace(/_/g, '-')}`);
                if (!el) {
                  // try partial match
                  const sections = document.querySelectorAll('[id^="section-"]');
                  for (const s of sections) {
                    if (s.id.includes(label.toLowerCase().replace(/_/g, '-'))) {
                      s.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      return;
                    }
                  }
                } else {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="font-label text-[8px] text-on-surface-variant hover:text-primary uppercase tracking-wider px-2 py-1 border border-outline-variant/20 hover:border-primary/30 transition-all duration-100 whitespace-nowrap shrink-0"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
              LOADING...
            </span>
          </div>
        ) : (
          <>
            <ConfigEditor draft={draft} onChange={handleChange} />

            {/* System Prompt Presets */}
            <PresetsSection />

            {/* System information (read-only) */}
            <Section index="06" title="SYSTEM_INFORMATION">
              {[
                { label: 'VECTOR_STORE', value: 'PGVECTOR' },
                { label: 'EMBEDDING_DIMS', value: '384 DIM' },
                { label: 'VECTOR_INDEX', value: 'HNSW' },
                { label: 'LLM_PROVIDER', value: (config?.llmProvider ?? 'ask-sage').toUpperCase().replace('-', '_') },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2.5 border-b border-outline-variant/10 last:border-0"
                >
                  <span className="font-label text-[10px] text-secondary uppercase tracking-widest">
                    {label}
                  </span>
                  <span className="font-label text-[11px] text-primary tabular-nums">{value}</span>
                </div>
              ))}
            </Section>

            {/* Interface / Theme toggle */}
            <Section index="07" title="INTERFACE">
              <div className="flex items-start justify-between py-2.5">
                <div>
                  <label className="font-label text-[10px] text-secondary uppercase tracking-widest block">
                    THEME_MODE
                  </label>
                  <p className="font-body text-[10px] text-on-surface-variant mt-0.5">
                    Display color scheme for the interface
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  className={`flex items-center gap-2 border px-3 py-1.5 font-label text-[10px] uppercase tracking-wider transition-all duration-150 ${
                    theme === 'dark'
                      ? 'border-outline-variant text-primary hover:border-primary hover:bg-primary/5'
                      : 'border-outline-variant text-secondary hover:border-primary hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  <span
                    className={`inline-block w-3 h-3 border shrink-0 transition-all duration-150 ${
                      theme === 'dark'
                        ? 'bg-primary-container border-primary'
                        : 'bg-transparent border-outline-variant'
                    }`}
                    aria-hidden="true"
                  />
                  {theme === 'dark' ? 'DARK_MODE' : 'LIGHT_MODE'}
                </button>
              </div>
            </Section>

            {/* Authentication */}
            <Section index="08" title="AUTHENTICATION">
              <FieldRow
                label="AUTH_ENABLED"
                description="Require username and password login. Create a user account before enabling or you will be locked out."
              >
                <ToggleInput
                  value={draft.authEnabled}
                  onChange={(v) => handleChange({ authEnabled: v })}
                  label="Toggle authentication"
                />
              </FieldRow>
            </Section>

            {/* API Keys & Webhook docs */}
            <ApiKeysSection sectionIndex="09" />

            {/* Watched Folders */}
            <WatchedFoldersSection />

            {/* Plugin system */}
            <PluginsPanel />

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2 pb-4">
              <button
                onClick={handleSave}
                disabled={!hasChanges || updateConfig.isPending}
                aria-label="Save configuration changes"
                className="btn-primary text-[10px] px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {updateConfig.isPending ? 'SAVING...' : 'COMMIT_CHANGES_'}
              </button>
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                aria-label="Reset to last saved values"
                className="btn-secondary text-[10px] px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                RESET_
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
