interface BulletProps {
  icon: string;
  text: string;
}

function Bullet({ icon, text }: BulletProps) {
  return (
    <li className="flex items-start gap-3 text-on-surface-variant leading-relaxed">
      <span className="material-symbols-outlined text-primary text-base mt-1 flex-shrink-0">
        {icon}
      </span>
      <span>{text}</span>
    </li>
  );
}

export function WikiAndNotes() {
  return (
    <section id="wiki-notes" className="bg-surface-container py-24 px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center mb-16 text-center">
          <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-4">
            Wiki &amp; Notes
          </h2>
          <p className="text-secondary font-medium tracking-widest uppercase text-sm">
            A knowledge base that grows itself &mdash; and notes you actually own.
          </p>
          <div className="w-24 h-1 bg-tertiary mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Left: Wiki */}
          <div className="bg-surface p-10 border-l-4 border-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-8xl">auto_awesome</span>
            </div>
            <div className="text-primary mb-6">
              <span
                className="material-symbols-outlined text-5xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
            <h3 className="font-headline text-3xl font-bold mb-2 text-ink-stamped">
              A wiki that writes itself.
            </h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              Every source you drop in gets read by an LLM and woven into a living reference. Your
              vault stops being a folder of files and starts being a knowledge base.
            </p>
            <ul className="space-y-3">
              <Bullet icon="article" text="Entity and concept pages synthesized from every source" />
              <Bullet icon="forum" text="Conversations with your vault become wiki pages automatically" />
              <Bullet icon="sync" text="Incremental synthesis — only regenerates what changed" />
              <Bullet icon="history" text="Full version history per page, with one-click regenerate" />
              <Bullet icon="link" text="Auto-wikify scans new content and links to existing pages" />
              <Bullet icon="fact_check" text="Scheduled lint pass surfaces contradictions and gaps" />
            </ul>
          </div>

          {/* Right: Notes */}
          <div className="bg-surface p-10 border-l-4 border-secondary relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-8xl">edit_note</span>
            </div>
            <div className="text-secondary mb-6">
              <span className="material-symbols-outlined text-5xl">edit_note</span>
            </div>
            <h3 className="font-headline text-3xl font-bold mb-2 text-on-surface">
              Notes the way you already write.
            </h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              A native markdown editor for the vault — not a walled garden. Your notes stay portable,
              plain-text, and yours.
            </p>
            <ul className="space-y-3">
              <Bullet icon="description" text="Plain markdown files on disk — nothing proprietary" />
              <Bullet icon="data_object" text="YAML frontmatter for tags, metadata, and aliases" />
              <Bullet icon="alternate_email" text="[[wiki-link]] autocomplete with live backlinks" />
              <Bullet icon="auto_fix_high" text="AI-suggested links as you write" />
              <Bullet icon="folder" text="Folders, tags, and full-text search built in" />
              <Bullet icon="save" text="Auto-save with nothing to configure" />
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
