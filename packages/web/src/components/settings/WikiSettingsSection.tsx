import type { AppConfig } from '@delve/shared';

interface WikiSettingsSectionProps {
  draft: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
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

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
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

export function WikiSettingsSection({ draft, onChange }: WikiSettingsSectionProps) {
  return (
    <div className="mb-6" id="section-wiki">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
          LLM_WIKI
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      <div className="bg-surface-container border border-outline-variant/20 px-3">
        <FieldRow
          label="WIKI_ENABLED"
          description="Master toggle for LLM-powered wiki generation. When enabled, ingested sources trigger automatic wiki page creation."
        >
          <Toggle
            value={draft.wikiEnabled}
            onChange={(v) => onChange({ wikiEnabled: v })}
            label="Toggle wiki generation"
          />
        </FieldRow>

        {draft.wikiEnabled && (
          <>
            <FieldRow
              label="AUTO_INGEST"
              description="Automatically generate wiki pages when a new source is ingested"
            >
              <Toggle
                value={draft.wikiAutoIngest}
                onChange={(v) => onChange({ wikiAutoIngest: v })}
                label="Toggle auto-ingest wiki generation"
              />
            </FieldRow>

            <FieldRow
              label="AUTO_PROMOTE"
              description="Automatically promote high-quality chat answers to wiki pages"
            >
              <Toggle
                value={draft.wikiAutoPromote}
                onChange={(v) => onChange({ wikiAutoPromote: v })}
                label="Toggle auto-promote"
              />
            </FieldRow>

            <FieldRow
              label="MAX_PAGES_PER_INGEST"
              description="Maximum wiki pages generated per source document"
            >
              <input
                type="number"
                value={draft.wikiMaxPagesPerIngest}
                onChange={(e) => onChange({ wikiMaxPagesPerIngest: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                min={1}
                max={20}
                className="w-16 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-0.5 outline-none focus:border-primary text-right"
              />
            </FieldRow>

            <FieldRow
              label="WIKI_FOLDER"
              description="Note folder path for generated wiki pages"
            >
              <input
                type="text"
                value={draft.wikiParentPath}
                onChange={(e) => onChange({ wikiParentPath: e.target.value })}
                className="w-32 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-0.5 outline-none focus:border-primary"
              />
            </FieldRow>

            <FieldRow
              label="GENERATION_MODEL"
              description="LLM model for wiki generation. Leave empty to use the default LLM model."
            >
              <input
                type="text"
                value={draft.wikiGenerationModel}
                onChange={(e) => onChange({ wikiGenerationModel: e.target.value })}
                placeholder="(default)"
                className="w-48 bg-surface-container border-b border-outline-variant font-label text-[11px] text-primary px-2 py-0.5 outline-none focus:border-primary placeholder:text-on-surface-variant/40"
              />
            </FieldRow>
          </>
        )}
      </div>
    </div>
  );
}
