import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';

type View = 'chat' | 'sources' | 'settings' | 'notes';

interface LayoutProps {
  activeView: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export function Layout({ activeView, onNavigate, children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleNavigate(view: View) {
    onNavigate(view);
    setMobileMenuOpen(false);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-obsidian-base">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar activeView={activeView} onNavigate={onNavigate} />
      </div>

      {/* Mobile header — shown only on small screens */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex md:hidden items-center justify-between px-4 py-2 bg-obsidian-surface border-b border-obsidian-border/20 shrink-0">
          <div className="flex items-baseline gap-1">
            <span
              className="font-mono font-bold text-sm tracking-[0.2em] text-phosphor"
              style={{ textShadow: '0 0 12px rgba(171,214,0,0.5)' }}
            >
              DELVE
            </span>
            <span className="font-mono text-xs text-ui-dim">_</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="p-2 text-ui-muted hover:text-ui-text transition-colors duration-100"
          >
            {mobileMenuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-obsidian-base/80 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed top-0 left-0 bottom-0 w-52 z-50 md:hidden">
              <Sidebar activeView={activeView} onNavigate={handleNavigate} />
            </div>
          </>
        )}

        <main className="flex-1 overflow-hidden bg-obsidian-sunken" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
