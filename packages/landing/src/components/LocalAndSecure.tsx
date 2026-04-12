interface TrustItemProps {
  icon: string;
  title: string;
  description: string;
}

function TrustItem({ icon, title, description }: TrustItemProps) {
  return (
    <div className="flex gap-4">
      <span
        className="material-symbols-outlined text-primary text-3xl flex-shrink-0 mt-1"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <div>
        <h4 className="font-headline text-lg font-bold text-on-surface mb-1">{title}</h4>
        <p className="text-on-surface-variant text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function LocalAndSecure() {
  return (
    <section id="privacy" className="py-24 px-8 bg-surface-container-high relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 mb-6 text-sm font-bold uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">shield_lock</span>
              Local &middot; Private &middot; Auditable
            </div>
            <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-6 leading-tight">
              Your data never leaves the machine you choose.
            </h2>
            <p className="text-xl text-on-surface-variant leading-relaxed mb-6">
              Most "AI knowledge" tools quietly pipe your documents through someone else's
              infrastructure. Piper Vault doesn't. The database, the embedding model, the UI,
              and your notes all live in one Docker container on hardware you control.
            </p>
            <p className="text-on-surface-variant leading-relaxed">
              Want to go fully offline? Swap the cloud LLM for Ollama and nothing — not a
              token, not a metric, not a heartbeat — leaves your network.
            </p>
          </div>

          <div className="space-y-8 bg-surface p-10">
            <TrustItem
              icon="home_storage"
              title="One container. One machine. Yours."
              description="Postgres, pgvector, the API server, the React UI, and the embedding model all ship in a single Docker image. No external services required."
            />
            <TrustItem
              icon="memory"
              title="Embeddings generated locally"
              description="Sources are embedded on-device with all-MiniLM-L6-v2 via ONNX (384-dim). Upgrade to a larger local model through Ollama any time."
            />
            <TrustItem
              icon="cloud_off"
              title="Zero telemetry, zero phone-home"
              description="No analytics. No usage beacons. No account required to run the software. Audit the source — every network call is visible."
            />
            <TrustItem
              icon="vpn_key"
              title="Bring your own LLM keys"
              description="Use Anthropic, OpenAI, or Ask Sage with your own API keys. Or skip cloud LLMs entirely and run Ollama locally for a fully offline experience."
            />
            <TrustItem
              icon="code_blocks"
              title="AGPL-3.0, top to bottom"
              description="Every line of code is open source. Your security team can read it. You can fork it. If we ever go away, the software keeps working."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
