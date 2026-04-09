import { useWikiLog } from '../../hooks/use-wiki';

const OPERATION_LABELS: Record<string, string> = {
  ingest: 'INGEST',
  query: 'PROMOTE',
  lint: 'LINT',
  update: 'UPDATE',
};

const OPERATION_COLORS: Record<string, string> = {
  ingest: 'text-primary',
  query: 'text-blue-400',
  lint: 'text-yellow-500',
  update: 'text-green-500',
};

export function WikiLog() {
  const { data, isLoading, isError } = useWikiLog({ limit: 50 });
  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
          LOADING_LOG...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <span className="font-label text-[10px] text-error uppercase tracking-widest">
          LOG_LOAD_FAILED
        </span>
        <p className="font-body text-[11px] text-on-surface-variant mt-2">
          Could not load the wiki activity log.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
          NO_WIKI_ACTIVITY_YET
        </span>
        <p className="font-body text-[11px] text-on-surface-variant mt-2">
          Enable the LLM Wiki in Settings and ingest a source to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Wiki Activity Log</h2>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 py-2 px-3 border-b border-outline-variant/10 last:border-0 bg-surface-container"
        >
          <span className={`font-label text-[9px] uppercase tracking-wider mt-0.5 w-16 shrink-0 ${OPERATION_COLORS[item.operation] ?? 'text-secondary'}`}>
            {OPERATION_LABELS[item.operation] ?? item.operation.toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[11px] text-on-surface leading-relaxed">
              {item.summary}
            </p>
            {item.affectedSourceIds.length > 0 && (
              <p className="font-label text-[9px] text-on-surface-variant mt-0.5">
                {item.affectedSourceIds.length} page(s) affected
              </p>
            )}
          </div>
          <span className="font-label text-[9px] text-on-surface-variant tabular-nums shrink-0">
            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  );
}
