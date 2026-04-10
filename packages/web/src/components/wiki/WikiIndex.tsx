import { useState } from 'react';
import { useWikiIndex, useInitializeWiki } from '../../hooks/use-wiki';

interface WikiIndexProps {
  readonly selectedPageId?: string;
  readonly onSelectPage: (pageId: string) => void;
}

export function WikiIndex({ selectedPageId, onSelectPage }: WikiIndexProps) {
  const { data, isLoading, isError } = useWikiIndex();
  const categories = data?.categories ?? [];
  const initMutation = useInitializeWiki();
  const [initSummary, setInitSummary] = useState<string>('');

  async function handleInitialize() {
    try {
      const result = await initMutation.mutateAsync({});
      if (result.ok && result.value) {
        setInitSummary(result.value.summary);
      } else {
        setInitSummary(result.error ?? 'Initialization failed');
      }
    } catch {
      setInitSummary('Failed to initialize wiki');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
          BUILDING_INDEX...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <span className="font-label text-[10px] text-error uppercase tracking-widest">
          INDEX_LOAD_FAILED
        </span>
        <p className="font-body text-[11px] text-on-surface-variant mt-2">
          Could not load the wiki index. Check that the API is running.
        </p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
          NO_WIKI_PAGES_YET
        </span>
        <p className="font-body text-[11px] text-on-surface-variant mt-2">
          Enable the LLM Wiki in Settings to start generating wiki pages from your sources.
        </p>
        <button
          onClick={handleInitialize}
          disabled={initMutation.isPending}
          className="font-label text-[10px] uppercase tracking-wider px-4 py-2 mt-4 border border-primary text-primary bg-primary/5 hover:bg-primary/10 transition-all duration-100 disabled:opacity-40"
        >
          {initMutation.isPending ? 'INITIALIZING...' : 'INITIALIZE FROM EXISTING SOURCES'}
        </button>
        {initSummary && (
          <p className="font-label text-[10px] text-secondary uppercase tracking-wider mt-3">
            {initSummary}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Wiki Index</h2>
        <div className="flex-1 h-px bg-outline-variant/20" />
        <button
          onClick={handleInitialize}
          disabled={initMutation.isPending}
          className="font-label text-[9px] uppercase tracking-wider px-3 py-1.5 border border-outline-variant/20 text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all duration-100 disabled:opacity-40"
        >
          {initMutation.isPending ? 'INITIALIZING...' : 'INITIALIZE'}
        </button>
      </div>
      {initSummary && (
        <p className="font-label text-[10px] text-secondary uppercase tracking-wider">
          {initSummary}
        </p>
      )}
      {categories.map((cat) => (
        <div key={cat.name}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
              {cat.name}
            </span>
            <span className="font-label text-[9px] text-on-surface-variant">
              ({cat.pages.length})
            </span>
          </div>
          <div className="bg-surface-container border border-outline-variant/20">
            {cat.pages.map((page) => (
              <button
                key={page.id || page.title}
                onClick={() => page.id && onSelectPage(page.id)}
                className={`w-full text-left flex items-start gap-3 px-3 py-2 border-b border-outline-variant/10 last:border-0 transition-all duration-100 ${
                  selectedPageId === page.id
                    ? 'bg-primary/5'
                    : 'hover:bg-surface-container-high'
                }`}
              >
                <span className={`font-body text-[11px] font-medium shrink-0 ${
                  selectedPageId === page.id ? 'text-primary' : 'text-primary/80 hover:text-primary'
                }`}>
                  {page.title}
                </span>
                <span className="font-body text-[10px] text-on-surface-variant flex-1 truncate">
                  {page.summary}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
