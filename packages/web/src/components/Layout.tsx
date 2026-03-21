import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

type View = 'chat' | 'sources' | 'settings';

interface LayoutProps {
  activeView: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export function Layout({ activeView, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-obsidian-base">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />
      <main className="flex-1 overflow-hidden bg-obsidian-sunken" role="main">
        {children}
      </main>
    </div>
  );
}
