import { useQuery } from '@tanstack/react-query';
import { DEFAULT_CONFIG } from '@delve/shared';
import type { AppConfig } from '@delve/shared';
import { api } from '../../api/client';

interface ConfigFieldProps {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
}

function ConfigField({ label, value, unit, description }: ConfigFieldProps) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-obsidian-border/10 last:border-0">
      <div className="flex-1">
        <label className="font-mono text-[10px] text-ui-muted uppercase tracking-widest block">
          {label}
        </label>
        {description && (
          <p className="font-sans text-[10px] text-ui-dim mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 ml-4">
        <span className="font-mono text-[11px] text-phosphor tabular-nums">{value}</span>
        {unit && <span className="font-mono text-[9px] text-ui-dim uppercase">{unit}</span>}
      </div>
    </div>
  );
}

interface SectionProps {
  index: string;
  title: string;
  children: React.ReactNode;
}

function Section({ index, title, children }: SectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[9px] text-phosphor uppercase tracking-widest">
          {index}
        </span>
        <span className="font-mono text-[10px] text-ui-muted uppercase tracking-wider">
          {title}
        </span>
        <div className="flex-1 h-px bg-obsidian-border/20" />
      </div>
      <div className="bg-obsidian-sunken border border-obsidian-border/20 px-3">
        {children}
      </div>
    </div>
  );
}

function ConfigDisplay({ config }: { config: AppConfig }) {
  return (
    <>
      <Section index="01" title="LLM_CONFIGURATION">
        <ConfigField
          label="LLM_MODEL"
          value={config.llmModel}
          description="Language model used for answer generation via Ask Sage"
        />
        <ConfigField
          label="MAX_CONTEXT_TOKENS"
          value={config.maxContextTokens}
          unit="TOKENS"
          description="Maximum tokens from retrieved context fed to the LLM"
        />
        <ConfigField
          label="MAX_CONVERSATION_TURNS"
          value={config.maxConversationTurns}
          unit="TURNS"
          description="Number of prior turns included in each prompt"
        />
      </Section>

      <Section index="02" title="EMBEDDING_CONFIGURATION">
        <ConfigField
          label="EMBEDDING_MODEL"
          value={config.embeddingModel}
          description="Sentence transformer model for vector embedding generation"
        />
      </Section>

      <Section index="03" title="CHUNKING_STRATEGY">
        <ConfigField
          label="CHUNK_SIZE"
          value={config.chunkSize}
          unit="TOKENS"
          description="Target token count per document chunk"
        />
        <ConfigField
          label="CHUNK_OVERLAP"
          value={config.chunkOverlap}
          unit="TOKENS"
          description="Sliding window overlap between consecutive chunks"
        />
      </Section>

      <Section index="04" title="RETRIEVAL_PARAMETERS">
        <ConfigField
          label="TOP_K_RESULTS"
          value={config.topKResults}
          unit="CHUNKS"
          description="Number of vector-similar chunks retrieved per query"
        />
        <ConfigField
          label="SIMILARITY_THRESHOLD"
          value={config.similarityThreshold}
          description="Minimum cosine similarity score for chunk inclusion"
        />
      </Section>
    </>
  );
}

export function SettingsPanel() {
  const { data: config, isLoading, isError } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.getConfig(),
    // Fall back to defaults if API not available
  });

  const displayConfig = config ?? DEFAULT_CONFIG;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border/20 bg-obsidian-surface shrink-0">
        <div>
          <h1 className="font-display font-semibold text-ui-text text-sm">System Configuration</h1>
          <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mt-0.5">
            READ-ONLY · PHASE 1
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 ${
              isError
                ? 'bg-yellow-400'
                : isLoading
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-phosphor'
            }`}
          />
          <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest">
            {isError ? 'DEFAULT_VALUES' : isLoading ? 'FETCHING...' : 'LIVE_VALUES'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Note for Phase 1 */}
        <div className="mb-6 px-3 py-2.5 border border-obsidian-border/20 bg-obsidian-surface">
          <p className="font-mono text-[9px] text-ui-dim uppercase tracking-wider leading-relaxed">
            NOTE: Configuration is read-only in Phase 1. Values reflect the current runtime
            configuration or system defaults. Editing will be enabled in a future phase.
          </p>
        </div>

        <ConfigDisplay config={displayConfig} />

        {/* Models section */}
        <Section index="05" title="SYSTEM_INFORMATION">
          <ConfigField
            label="VECTOR_STORE"
            value="PGVECTOR"
            description="PostgreSQL extension for ANN vector similarity search"
          />
          <ConfigField
            label="EMBEDDING_DIMS"
            value={384}
            unit="DIM"
            description="all-MiniLM-L6-v2 output dimensionality"
          />
          <ConfigField
            label="VECTOR_INDEX"
            value="HNSW"
            description="Hierarchical Navigable Small World index for fast ANN search"
          />
          <ConfigField
            label="LLM_PROVIDER"
            value="ASK SAGE"
            description="Unified LLM gateway providing access to Claude, GPT-4, Gemini"
          />
        </Section>
      </div>
    </div>
  );
}
