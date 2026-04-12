interface ProviderProps {
  name: string;
  tag: string;
  note: string;
}

function Provider({ name, tag, note }: ProviderProps) {
  return (
    <div className="bg-surface p-8 flex flex-col items-start border-t-2 border-tertiary/40 hover:border-primary transition-colors">
      <span className="text-xs font-label uppercase tracking-widest text-secondary mb-2">
        {tag}
      </span>
      <h4 className="font-headline text-2xl font-bold text-on-surface mb-2">{name}</h4>
      <p className="text-on-surface-variant text-sm leading-relaxed">{note}</p>
    </div>
  );
}

export function LLMProviders() {
  return (
    <section id="providers" className="bg-surface-container py-24 px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-12 text-center">
          <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-4">
            Any LLM. Your Key.
          </h2>
          <p className="text-secondary font-medium tracking-widest uppercase text-sm max-w-2xl">
            Bring your own provider, or run fully offline. Switch any time from the settings panel.
          </p>
          <div className="w-24 h-1 bg-tertiary mt-4" />
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          <Provider
            tag="Cloud · Streaming"
            name="Anthropic"
            note="Claude models. Native SSE streaming, tool-use compatible."
          />
          <Provider
            tag="Cloud · Streaming"
            name="OpenAI"
            note="GPT models with native streaming. Works with Azure OpenAI too."
          />
          <Provider
            tag="Local · Offline"
            name="Ollama"
            note="Run Llama, Mistral, or any Ollama-compatible model fully offline."
          />
          <Provider
            tag="Government · Enterprise"
            name="Ask Sage"
            note="FedRAMP-ready option for regulated environments. Token-based auth."
          />
        </div>
        <p className="text-center text-on-surface-variant text-sm mt-10 italic">
          Embeddings always run locally via ONNX — your vault is embedded on your machine,
          regardless of which LLM you chat with.
        </p>
      </div>
    </section>
  );
}
