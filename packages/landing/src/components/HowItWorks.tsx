interface StepProps {
  number: string;
  icon: string;
  title: string;
  description: string;
}

function Step({ number, icon, title, description }: StepProps) {
  return (
    <div className="flex flex-col items-start relative">
      <div className="flex items-center gap-4 mb-6">
        <span className="font-headline text-6xl font-black text-tertiary/30 leading-none">
          {number}
        </span>
        <span className="material-symbols-outlined text-primary text-5xl">{icon}</span>
      </div>
      <h3 className="font-headline text-2xl font-bold mb-3 text-on-surface">{title}</h3>
      <p className="text-on-surface-variant leading-relaxed">{description}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface py-24 px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-16 text-center">
          <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-4">
            How It Works
          </h2>
          <p className="text-secondary font-medium tracking-widest uppercase text-sm">
            Three steps from blank vault to your own knowledge engine.
          </p>
          <div className="w-24 h-1 bg-tertiary mt-4" />
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          <Step
            number="01"
            icon="upload_file"
            title="Ingest"
            description="Drag in PDFs, DOCX, CSV, HTML, markdown, or plain text. Point at a folder on disk and Piper Vault watches it. Write notes directly in the built-in markdown editor. Everything gets chunked, embedded locally, and stored in your own Postgres."
          />
          <Step
            number="02"
            icon="hub"
            title="Connect"
            description="Auto-wikify links your notes and sources together. The LLM reads every source you add and synthesizes a living wiki — entity pages, concept summaries, cross-references. Wiki-links [[like this]] get autocomplete and backlinks."
          />
          <Step
            number="03"
            icon="forum"
            title="Ask"
            description="Chat with your vault in natural language. Hybrid semantic + keyword search pulls the most relevant chunks. Answers are grounded in your knowledge with inline citations back to the original source. Pick any LLM — Claude, GPT, or a local model via Ollama."
          />
        </div>
      </div>
    </section>
  );
}
