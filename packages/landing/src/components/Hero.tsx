export function Hero() {
  return (
    <section className="relative overflow-hidden px-8 py-20 min-h-[870px] flex items-center">
      <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="z-10">
          <h1 className="font-headline text-6xl md:text-7xl font-extrabold text-primary leading-[1.1] tracking-tighter mb-6">
            UNEARTH YOUR KNOWLEDGE BASE.{' '}
            <span className="text-secondary italic">SECURELY. PRIVATELY. LOCAL.</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-lg mb-10 leading-relaxed">
            P.I.P.E.R. Vault: Your Sovereign Intelligence Protocol. One Docker Container. The
            ultimate repository for private intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="bg-primary text-on-primary px-8 py-4 rounded-sm font-bold text-lg flex items-center justify-center gap-3 hover:bg-primary-container transition-all btn-press group">
              <span className="material-symbols-outlined">link</span>
              Download Now on Docker Hub
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                lock
              </span>
            </button>
          </div>
        </div>
        <div className="relative w-full mt-12 overflow-hidden rounded shadow-2xl border-4 border-primary/10">
          <img
            alt="P.I.P.E.R. Vault Sovereign Data Companion"
            className="w-full h-auto object-cover"
            src="/hero.png"
          />
        </div>
      </div>
      {/* Decorative Background Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] contrast-150 grayscale"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuABrFoOTcN2wbDDhJpxndd-lJLy7z86t6M_3fbkZvC6zkIp_dMsvcwyGYuaY5EAKebnU6EplyEzDcB6Vy9_uJDKcGNgVXODnKY0aL43nCyZohoKpl0v8N4fSa3kZ11HpoW-zTweVeKdLhZ42LpquWBYH_78W7sGHAg1-5mcjZaiGHTfnpkgaVSQYLGI8yJ7r37t3Bt3sCQmm_3psw1u_R7Icw8XpaWuQu7XA7_EJNiKwGul1YPPZsN__DsP6Y7mDuSmnxXG7r-L7w')",
        }}
      />
    </section>
  );
}
