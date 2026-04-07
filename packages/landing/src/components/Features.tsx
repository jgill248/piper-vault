interface FeatureCardProps {
  icon: string;
  iconFill?: boolean;
  title: string;
  description: string;
  decorativeIcon?: string;
}

function FeatureCard({ icon, iconFill, title, description, decorativeIcon }: FeatureCardProps) {
  return (
    <div className="bg-surface p-10 flex flex-col items-start hover:translate-y-[-4px] transition-transform shadow-sm relative overflow-hidden">
      {decorativeIcon && (
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span className="material-symbols-outlined text-8xl">{decorativeIcon}</span>
        </div>
      )}
      <div className="text-primary mb-6">
        <span
          className="material-symbols-outlined text-5xl"
          style={iconFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {icon}
        </span>
      </div>
      <h3 className="font-headline text-2xl font-bold mb-4 text-ink-stamped">{title}</h3>
      <p className="text-on-surface-variant leading-relaxed">{description}</p>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="bg-surface-container py-24 px-8">
      <div className="container mx-auto">
        <div className="flex flex-col items-center mb-16 text-center">
          <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-4">
            Features
          </h2>
          <p className="text-secondary font-medium tracking-widest uppercase text-sm">
            Everything you need. Nothing you don't control.
          </p>
          <div className="w-24 h-1 bg-tertiary mt-4" />
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          <FeatureCard
            icon="search"
            title="AI-Powered Search"
            description="Chat with your documents using any LLM provider — Anthropic, OpenAI, Ollama, or Ask Sage. Semantic search with citation-backed answers grounded in your knowledge."
          />
          <FeatureCard
            icon="hub"
            title="Knowledge Graph"
            description="Connect notes with [[wiki-links]], visualize relationships in an interactive force-directed graph, and discover connections you didn't know existed."
            decorativeIcon="hub"
          />
          <FeatureCard
            icon="shield_lock"
            iconFill
            title="Fully Local"
            description="Your data never leaves your machine. Embeddings run locally via ONNX. No cloud dependency, no telemetry, no third-party data processing. Audit every line of code."
          />
          <FeatureCard
            icon="description"
            title="Multi-Format Ingestion"
            description="PDF, DOCX, CSV, JSON, HTML, Markdown, plain text. Drag and drop files, import directories, or auto-ingest from watched folders."
          />
          <FeatureCard
            icon="edit_note"
            title="Native Note Editor"
            description="Write in Markdown with auto-save, YAML frontmatter, wiki-link autocomplete, backlinks, and AI-powered link suggestions — all built in."
            decorativeIcon="edit_note"
          />
          <FeatureCard
            icon="extension"
            title="Extensible"
            description="Plugin system for custom file parsers. Webhook API for external integrations. System prompt presets for per-model tuning. Open source — extend anything."
          />
        </div>
      </div>
    </section>
  );
}
