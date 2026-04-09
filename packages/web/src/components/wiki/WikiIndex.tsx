import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface WikiCategory {
  name: string;
  pages: { title: string; summary: string }[];
}

export function WikiIndex() {
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWikiIndex()
      .then((res) => setCategories(res.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
          BUILDING_INDEX...
        </span>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Wiki Index</h2>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      {categories.map((cat) => (
        <div key={cat.name}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-label text-[10px] text-secondary uppercase tracking-wider">
              {cat.name}
            </span>
            <span className="font-label text-[9px] text-on-surface-variant">
              ({cat.pages.length})
            </span>
          </div>
          <div className="bg-surface-container border border-outline-variant/20">
            {cat.pages.map((page) => (
              <div
                key={page.title}
                className="flex items-start gap-3 px-3 py-2 border-b border-outline-variant/10 last:border-0"
              >
                <span className="font-body text-[11px] text-primary font-medium">
                  {page.title}
                </span>
                <span className="font-body text-[10px] text-on-surface-variant flex-1 truncate">
                  {page.summary}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
