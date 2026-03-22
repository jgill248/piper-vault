import { MessageSquare, Database, Settings, Activity } from 'lucide-react';
import { useHealth } from '../hooks/use-health';
import { CollectionSelector } from './collections/CollectionSelector';

type View = 'chat' | 'sources' | 'settings';

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
    id: 'settings',
    label: 'SETTINGS',
    icon: <Settings size={14} strokeWidth={1.5} />,
  },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { data: health, isError, isLoading } = useHealth();

  const systemStatus = isLoading
    ? { label: 'CONNECTING', color: 'text-ui-dim' }
    : isError || health?.status !== 'ok'
      ? { label: 'OFFLINE', color: 'text-red-400' }
      : { label: 'ONLINE', color: 'text-phosphor' };

  return (
    <aside className="flex flex-col w-52 bg-obsidian-surface border-r border-obsidian-border/20 shrink-0 h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-obsidian-border/20">
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono font-bold text-lg tracking-[0.2em] text-phosphor"
            style={{ textShadow: '0 0 12px rgba(171,214,0,0.5)' }}
          >
            DELVE
          </span>
          <span className="font-mono text-xs text-ui-dim">_</span>
        </div>
        <p className="font-mono text-[10px] text-ui-dim tracking-wider mt-0.5 uppercase">
          Knowledge Engine
        </p>
      </div>

      {/* Collection selector */}
      <div className="border-b border-obsidian-border/20">
        <div className="px-3 pt-2 pb-1">
          <span className="font-mono text-[8px] text-ui-dim uppercase tracking-widest">
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
      <div className="px-4 py-4 border-t border-obsidian-border/20">
        <div className="flex items-center gap-2">
          <Activity size={10} className={systemStatus.color} />
          <span className={`font-mono text-[10px] tracking-widest uppercase ${systemStatus.color}`}>
            SYS:{systemStatus.label}
          </span>
        </div>
        {health && (
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-ui-dim uppercase">DB</span>
              <span
                className={`font-mono text-[9px] uppercase ${
                  health.db === 'ok' ? 'text-phosphor' : 'text-red-400'
                }`}
              >
                {health.db === 'ok' ? 'CONNECTED' : 'ERROR'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-ui-dim uppercase">EMBED</span>
              <span
                className={`font-mono text-[9px] uppercase ${
                  health.embedding === 'ok' ? 'text-phosphor' : 'text-yellow-400'
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
