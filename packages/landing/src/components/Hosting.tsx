interface HostingFeature {
  icon: string;
  iconColor: string;
  text: string;
  bold?: boolean;
}

interface HostingCardProps {
  title: string;
  priceLabel: string;
  priceLabelColor?: string;
  priceNote?: string;
  features: HostingFeature[];
  borderColor: string;
  bgClass: string;
  featured?: boolean;
  badge?: string;
  primaryCta?: { text: string; href: string };
  secondaryCta?: { text: string; href: string };
  comingSoon?: boolean;
}

function HostingCard({
  title,
  priceLabel,
  priceLabelColor = 'text-primary',
  priceNote,
  features,
  borderColor,
  bgClass,
  featured,
  badge,
  primaryCta,
  secondaryCta,
  comingSoon,
}: HostingCardProps) {
  return (
    <div
      className={`border-b-4 ${borderColor} ${bgClass} p-10 flex flex-col h-full ${
        featured ? 'transform scale-105 shadow-2xl relative z-10' : 'relative'
      }`}
    >
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 text-xs font-bold uppercase tracking-widest">
          {badge}
        </div>
      )}
      <div className="mb-8">
        <h4
          className={`font-headline text-3xl font-bold mb-2 ${featured ? 'text-primary' : 'text-on-surface'}`}
        >
          {title}
        </h4>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black ${priceLabelColor}`}>{priceLabel}</span>
        </div>
        {priceNote && (
          <p className="text-xs text-on-surface-variant italic mt-1">{priceNote}</p>
        )}
      </div>
      <ul className="space-y-4 mb-10 flex-grow">
        {features.map((feature) => (
          <li
            key={feature.text}
            className={`flex items-center gap-3 ${feature.bold ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}
          >
            <span className={`material-symbols-outlined ${feature.iconColor} text-sm`}>
              {feature.icon}
            </span>
            {feature.text}
          </li>
        ))}
      </ul>
      {comingSoon ? (
        <button
          disabled
          className="w-full py-4 bg-outline/40 text-on-surface/60 font-bold cursor-not-allowed"
        >
          Coming Soon
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {primaryCta && (
            <a
              href={primaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-primary text-on-primary font-bold text-center flex items-center justify-center gap-2 hover:bg-primary-container transition-all btn-press"
            >
              <span className="material-symbols-outlined text-sm">deployed_code</span>
              {primaryCta.text}
            </a>
          )}
          {secondaryCta && (
            <a
              href={secondaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 border-2 border-primary text-primary font-bold text-center flex items-center justify-center gap-2 hover:bg-primary/5 transition-all btn-press"
            >
              <span className="material-symbols-outlined text-sm">code</span>
              {secondaryCta.text}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function Hosting() {
  return (
    <section id="hosting" className="py-24 px-8 bg-surface">
      <div className="container mx-auto">
        <div className="flex flex-col items-center mb-16 text-center">
          <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-4">
            Hosting
          </h2>
          <p className="text-secondary font-medium tracking-widest uppercase text-sm">
            Free and open source. Self-host today &mdash; managed options coming soon.
          </p>
          <div className="w-24 h-1 bg-tertiary mt-4" />
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch pt-6">
          <HostingCard
            title="Self-Host"
            priceLabel="Free Forever"
            priceLabelColor="text-primary"
            priceNote="Run it on your own machine"
            borderColor="border-primary"
            bgClass="bg-surface-container-highest"
            featured
            badge="Recommended"
            primaryCta={{
              text: 'Pull from Docker Hub',
              href: 'https://hub.docker.com/r/pipervault/piper-vault',
            }}
            secondaryCta={{
              text: 'View on GitHub',
              href: 'https://github.com/jgill248/piper-vault',
            }}
            features={[
              { icon: 'verified', iconColor: 'text-primary', text: 'Every feature included', bold: true },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'All LLM providers (Anthropic, OpenAI, Ollama, Ask Sage)' },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'LLM Wiki synthesis & version history' },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'Knowledge graph & wiki-links' },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'Native markdown editor' },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'Watched folders & webhook ingestion' },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'Plugin system' },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'AGPL-3.0 — fork, audit, modify' },
            ]}
          />
          <HostingCard
            title="Piper Vault Cloud"
            priceLabel="Coming Soon"
            priceLabelColor="text-on-surface-variant"
            priceNote="We host it for you"
            borderColor="border-outline-variant"
            bgClass="bg-surface-container-low"
            comingSoon
            features={[
              { icon: 'schedule', iconColor: 'text-secondary', text: 'Everything in Self-Host', bold: true },
              { icon: 'schedule', iconColor: 'text-secondary', text: 'Hosted on infrastructure we manage' },
              { icon: 'schedule', iconColor: 'text-secondary', text: 'Automatic updates' },
              { icon: 'schedule', iconColor: 'text-secondary', text: 'Backups & restore' },
              { icon: 'schedule', iconColor: 'text-secondary', text: 'One-click vault provisioning' },
            ]}
          />
          <HostingCard
            title="Enterprise"
            priceLabel="Coming Soon"
            priceLabelColor="text-on-surface-variant"
            priceNote="For teams & organizations"
            borderColor="border-outline-variant"
            bgClass="bg-surface-container-low"
            comingSoon
            features={[
              { icon: 'schedule', iconColor: 'text-tertiary', text: 'Everything in Cloud', bold: true },
              { icon: 'schedule', iconColor: 'text-tertiary', text: 'SSO / OIDC integration' },
              { icon: 'schedule', iconColor: 'text-tertiary', text: 'Team workspaces & roles' },
              { icon: 'schedule', iconColor: 'text-tertiary', text: 'Audit logging' },
              { icon: 'schedule', iconColor: 'text-tertiary', text: 'Dedicated support' },
            ]}
          />
        </div>
        <p className="text-center text-on-surface-variant text-sm mt-12 max-w-2xl mx-auto italic">
          Piper Vault is AGPL-3.0. The self-hosted version and any future managed version share
          the same source — no proprietary fork, no feature gating.
        </p>
      </div>
    </section>
  );
}
