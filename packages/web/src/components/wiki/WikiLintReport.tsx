import { useState } from 'react';
import { useRunWikiLint } from '../../hooks/use-wiki';
import type { WikiLintIssue } from '../../api/client';

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-red-500 border-red-500/30',
  medium: 'text-yellow-500 border-yellow-500/30',
  low: 'text-on-surface-variant border-outline-variant/30',
};

const TYPE_LABELS: Record<string, string> = {
  broken_link: 'BROKEN_LINK',
  orphaned: 'ORPHANED',
  stale: 'STALE',
  contradiction: 'CONTRADICTION',
  missing_link: 'MISSING_LINK',
  incomplete: 'INCOMPLETE',
};

export function WikiLintReport() {
  const [issues, setIssues] = useState<WikiLintIssue[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [hasRun, setHasRun] = useState(false);
  const lintMutation = useRunWikiLint();

  async function handleRunLint() {
    try {
      const result = await lintMutation.mutateAsync({});
      if (result.ok && result.value) {
        setIssues(result.value.issues);
        setSummary(result.value.summary);
      } else {
        setSummary(result.error ?? 'Lint failed');
      }
      setHasRun(true);
    } catch {
      setSummary('Failed to run lint');
      setHasRun(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-sm font-semibold text-on-surface">Wiki Lint</h2>
          <div className="flex-1 h-px bg-outline-variant/20" />
        </div>
        <button
          onClick={handleRunLint}
          disabled={lintMutation.isPending}
          className="btn-secondary text-[10px] px-3 py-1.5 disabled:opacity-40"
        >
          {lintMutation.isPending ? 'RUNNING...' : 'RUN LINT'}
        </button>
      </div>

      {hasRun && summary && (
        <p className="font-label text-[10px] text-secondary uppercase tracking-wider">
          {summary}
        </p>
      )}

      {hasRun && issues.length === 0 && (
        <div className="text-center py-8">
          <span className="font-label text-[10px] text-primary uppercase tracking-widest">
            ALL_CLEAR
          </span>
          <p className="font-body text-[11px] text-on-surface-variant mt-1">
            No quality issues found in your wiki.
          </p>
        </div>
      )}

      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.map((issue, idx) => {
            const colors = SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS['low'];
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 py-2.5 px-3 border bg-surface-container ${colors}`}
              >
                <div className="shrink-0 flex flex-col items-center gap-1 w-20">
                  <span className="font-label text-[8px] uppercase tracking-wider">
                    {TYPE_LABELS[issue.type] ?? issue.type.toUpperCase()}
                  </span>
                  <span className="font-label text-[8px] uppercase tracking-wider opacity-60">
                    {issue.severity.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[11px] text-on-surface leading-relaxed">
                    {issue.description}
                  </p>
                  <p className="font-body text-[10px] text-on-surface-variant mt-1">
                    Fix: {issue.suggestedFix}
                  </p>
                  {issue.affectedPages.length > 0 && (
                    <p className="font-label text-[9px] text-on-surface-variant mt-1">
                      Pages: {issue.affectedPages.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
