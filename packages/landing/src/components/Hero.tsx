export function Hero() {
  return (
    <section className="relative overflow-hidden px-8 py-20 min-h-[870px] flex items-center">
      <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="z-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 mb-6 text-sm font-bold uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">lock_open_right</span>
            Open Source &middot; Free Forever &middot; AGPL-3.0
          </div>
          <h1 className="font-headline text-6xl md:text-7xl font-extrabold text-primary leading-[1.1] tracking-tighter mb-6">
            YOUR KNOWLEDGE.{' '}
            <span className="text-secondary italic">YOUR MACHINE. YOUR RULES.</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-lg mb-10 leading-relaxed">
            P.I.P.E.R. Vault is an open-source, local-first knowledge vault. Write notes, ingest
            documents, and let an LLM build a living wiki from everything you know — then chat with
            it using citation-backed answers. Runs in a single Docker container. No accounts. No
            telemetry. No data ever leaves your machine.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://github.com/jgill248/piper-vault"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-on-primary px-8 py-4 font-bold text-lg flex items-center justify-center gap-3 hover:bg-primary-container transition-all btn-press group"
            >
              <span className="material-symbols-outlined">code</span>
              View on GitHub
            </a>
            <a
              href="https://hub.docker.com/r/pipervault/piper-vault"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-primary text-primary px-8 py-4 font-bold text-lg flex items-center justify-center gap-3 hover:bg-primary/5 transition-all btn-press group"
            >
              <span className="material-symbols-outlined">deployed_code</span>
              Docker Hub
            </a>
          </div>
          <div className="mt-6 text-on-surface-variant text-sm font-mono">
            $ docker run -d -p 8080:8080 pipervault/piper-vault:latest
          </div>
        </div>
        <div className="relative w-full mt-12 overflow-hidden shadow-2xl border-4 border-primary/10">
          <img
            alt="P.I.P.E.R. Vault Knowledge Graph"
            className="w-full h-auto object-cover"
            src="/hero.png"
          />
        </div>
      </div>
    </section>
  );
}
