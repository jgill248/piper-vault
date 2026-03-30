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
          <div className="w-24 h-1 bg-tertiary" />
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          <FeatureCard
            icon="print"
            title="Cross-LLM Sync"
            description="Cross-LLM Instance, Community-driven, Prompt-intelligent RAG search. Synchronize your knowledge across disparate intelligence models."
          />
          <FeatureCard
            icon="inventory_2"
            title="Structured Context"
            description="Everything Community Support, +Entity Extraction, Priority E-mail support. Deep taxonomic organization of your digital legacy."
            decorativeIcon="inventory_2"
          />
          <FeatureCard
            icon="door_sliding"
            iconFill
            title="Air-Gapped Privacy"
            description="Vault Local Intelligence decoupled to ensure maximum secure roots and Privacy. Intelligence that never leaves your machine."
          />
        </div>
      </div>
    </section>
  );
}
