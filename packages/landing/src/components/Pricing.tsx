interface PricingFeature {
  icon: string;
  iconColor: string;
  text: string;
  bold?: boolean;
}

interface PricingCardProps {
  title: string;
  price: string;
  priceSuffix?: string;
  priceNote?: string;
  priceColor?: string;
  features: PricingFeature[];
  borderColor: string;
  bgClass: string;
  featured?: boolean;
  badge?: string;
}

function PricingCard({
  title,
  price,
  priceSuffix,
  priceNote,
  priceColor = 'text-primary',
  features,
  borderColor,
  bgClass,
  featured,
  badge,
}: PricingCardProps) {
  return (
    <div
      className={`border-b-4 ${borderColor} ${bgClass} p-10 flex flex-col h-full ${
        featured ? 'transform scale-105 shadow-2xl relative z-10' : ''
      }`}
    >
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-full">
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
          <span className={`text-4xl font-black ${priceColor}`}>{price}</span>
          {priceSuffix && (
            <span className="text-on-surface-variant font-label text-sm uppercase">
              {priceSuffix}
            </span>
          )}
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
      <button
        disabled
        className="w-full py-4 bg-outline/40 text-on-surface/60 font-bold rounded-sm cursor-not-allowed"
      >
        Coming Soon
      </button>
    </div>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-8 bg-surface">
      <div className="container mx-auto">
        <div className="flex flex-col items-center mb-16 text-center">
          <h2 className="font-headline text-5xl font-black text-primary uppercase tracking-tighter mb-4">
            Pricing
          </h2>
          <p className="text-secondary font-medium tracking-widest uppercase text-sm">
            Select Your Clearance Level
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <PricingCard
            title="Hobbyist Node"
            price="$5"
            priceSuffix="/ Month"
            priceNote="Billed Annually"
            borderColor="border-outline-variant"
            bgClass="bg-surface-container-low"
            features={[
              { icon: 'check_circle', iconColor: 'text-secondary', text: '1 Docker Instance' },
              { icon: 'check_circle', iconColor: 'text-secondary', text: 'Community Support' },
              { icon: 'check_circle', iconColor: 'text-secondary', text: 'Basic RAG Search' },
            ]}
          />
          <PricingCard
            title="Sovereign Pro"
            price="$19"
            priceSuffix="/ Month"
            priceNote="Billed Annually"
            borderColor="border-primary"
            bgClass="bg-surface-container-highest"
            featured
            badge="Most Sovereign"
            features={[
              {
                icon: 'verified',
                iconColor: 'text-primary',
                text: 'Everything in Hobbyist',
                bold: true,
              },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'Entity Extraction' },
              {
                icon: 'check_circle',
                iconColor: 'text-primary',
                text: 'Priority Email Support',
              },
              { icon: 'check_circle', iconColor: 'text-primary', text: 'Advanced Connectors' },
            ]}
          />
          <PricingCard
            title="Bureau Edition"
            price="Custom"
            priceColor="text-tertiary"
            priceNote="Enterprise Solutions"
            borderColor="border-tertiary"
            bgClass="bg-surface-container-low"
            features={[
              { icon: 'hub', iconColor: 'text-tertiary', text: 'Unlimited Nodes' },
              { icon: 'lock_open', iconColor: 'text-tertiary', text: 'SSO Integration' },
              { icon: 'description', iconColor: 'text-tertiary', text: 'Dedicated SLA' },
              { icon: 'history_edu', iconColor: 'text-tertiary', text: 'Audit Logging' },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
