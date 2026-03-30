export function Footer() {
  return (
    <footer className="w-full py-12 px-8 flex flex-col items-center border-t-4 border-tertiary bg-secondary text-surface">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
        <div className="text-lg font-bold text-surface font-headline uppercase tracking-widest">
          PIPER VAULT
        </div>
        <div className="flex flex-wrap justify-center gap-8 font-body text-sm uppercase tracking-widest">
          <a className="text-surface-container/80 hover:text-white transition-opacity" href="#">
            Terms
          </a>
          <a className="text-surface-container/80 hover:text-white transition-opacity" href="#">
            Privacy
          </a>
          <a className="text-surface underline hover:text-white transition-opacity" href="#">
            Docker Hub Auth Guide
          </a>
        </div>
      </div>
      <div className="text-center font-body text-xs uppercase tracking-[0.2em] opacity-60">
        &copy; 1894-2026 P.I.P.E.R. Vault Digital Printing House. All Rights Reserved.
      </div>
    </footer>
  );
}
