import { useState } from 'react';
import { WikiLog } from './WikiLog';
import { WikiIndex } from './WikiIndex';
import { WikiLintReport } from './WikiLintReport';

type WikiTab = 'index' | 'log' | 'lint';

const TABS: { id: WikiTab; label: string }[] = [
  { id: 'index', label: 'INDEX' },
  { id: 'log', label: 'LOG' },
  { id: 'lint', label: 'LINT' },
];

export function WikiPanel() {
  const [activeTab, setActiveTab] = useState<WikiTab>('index');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 bg-surface shrink-0">
        <div>
          <h1 className="font-headline font-semibold text-on-surface text-sm">LLM Wiki</h1>
          <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mt-0.5">
            AI-GENERATED KNOWLEDGE BASE
          </p>
        </div>
        <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant/20 bg-surface shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`font-label text-[9px] uppercase tracking-wider px-3 py-1.5 border transition-all duration-100 ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/30 hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'index' && <WikiIndex />}
        {activeTab === 'log' && <WikiLog />}
        {activeTab === 'lint' && <WikiLintReport />}
      </div>
    </div>
  );
}
