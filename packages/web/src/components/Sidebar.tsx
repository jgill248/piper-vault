import { useState } from 'react';
import { MessageSquare, Database, Settings, Activity, FileText } from 'lucide-react';
import { useHealth } from '../hooks/use-health';
import { CollectionSelector } from './collections/CollectionSelector';

type View = 'chat' | 'sources' | 'settings' | 'notes';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'chat',
    label: 'CHAT',
    icon: <MessageSquare size={14} strokeWidth={1.5} />,
  },
  {
    id: 'sources',
    label: 'SOURCES',
    icon: <Database size={14} strokeWidth={1.5} />,
  },
  {
    id: 'notes',
    label: 'NOTES',
    icon: <FileText size={14} strokeWidth={1.5} />,
  },
  {
    id: 'settings',
    label: 'SETTINGS',
    icon: <Settings size={14} strokeWidth={1.5} />,
  },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { data: health, isError, isLoading } = useHealth();
  const [statusExpanded, setStatusExpanded] = useState(false);

  const systemStatus = isLoading
    ? { label: 'CONNECTING', color: 'text-on-surface-variant', healthy: false }
    : isError || health?.status !== 'ok'
      ? { label: 'OFFLINE', color: 'text-error', healthy: false }
      : { label: 'ONLINE', color: 'text-primary', healthy: true };

  const hasIssue = !systemStatus.healthy || (health && (health.db !== 'ok' || health.embedding !== 'ok'));

  return (
    <aside className="flex flex-col w-52 bg-surface-container stamp-shadow shrink-0 h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b-4 border-primary-container">
        <div className="flex items-baseline gap-1">
          <span className="font-headline font-bold text-lg tracking-tight text-primary">
            P.I.P.E.R. <span className="font-light italic lowercase opacity-80">Vault</span>
          </span>
        </div>
        <p className="font-label text-[10px] text-secondary tracking-wider mt-0.5 uppercase">
          Sovereign Intelligence Protocol
        </p>
      </div>

      {/* Collection selector */}
      <div className="bg-surface-container-high">
        <div className="px-3 pt-2 pb-1">
          <span className="font-label text-[8px] text-on-surface-variant uppercase tracking-widest">
            COLLECTION
          </span>
        </div>
        <CollectionSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item w-full text-left ${activeView === item.id ? 'active' : ''}`}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <span className="shrink-0 opacity-70">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* System Status */}
      <div
        className="px-4 py-3 bg-surface-container-high cursor-pointer select-none"
        onClick={() => setStatusExpanded((v) => !v)}
        title="Click to expand system status"
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 shrink-0 ${
              hasIssue ? 'bg-error animate-pulse' : 'bg-primary-container'
            }`}
          />
          <span className={`font-label text-[10px] tracking-widest uppercase ${systemStatus.color}`}>
            SYS:{systemStatus.label}
          </span>
        </div>
        {(statusExpanded || hasIssue) && health && (
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-label text-[9px] text-on-surface-variant uppercase">DB</span>
              <span
                className={`font-label text-[9px] uppercase ${
                  health.db === 'ok' ? 'text-primary' : 'text-error'
                }`}
              >
                {health.db === 'ok' ? 'CONNECTED' : 'ERROR'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-label text-[9px] text-on-surface-variant uppercase">EMBED</span>
              <span
                className={`font-label text-[9px] uppercase ${
                  health.embedding === 'ok' ? 'text-primary' : 'text-yellow-700 dark:text-yellow-400'
                }`}
              >
                {health.embedding === 'ok' ? 'READY' : 'WARN'}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
