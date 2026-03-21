import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useListSources } from '../../hooks/use-sources';

export interface SearchFilterState {
  sourceIds: string[];
  fileTypes: string[];
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: SearchFilterState = {
  sourceIds: [],
  fileTypes: [],
  dateFrom: '',
  dateTo: '',
};

const FILE_TYPE_OPTIONS = ['PDF', 'DOCX', 'CSV', 'JSON', 'HTML', 'MD', 'TXT'];

interface SearchFiltersProps {
  filters: SearchFilterState;
  onChange: (filters: SearchFilterState) => void;
}

function activeFilterCount(filters: SearchFilterState): number {
  let count = 0;
  if (filters.sourceIds.length > 0) count++;
  if (filters.fileTypes.length > 0) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  return count;
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: sourcesData } = useListSources(1, 100);
  const sources = sourcesData?.data ?? [];

  const activeCount = activeFilterCount(filters);

  function handleClearAll() {
    onChange(EMPTY_FILTERS);
  }

  function toggleSourceId(id: string) {
    const next = filters.sourceIds.includes(id)
      ? filters.sourceIds.filter((s) => s !== id)
      : [...filters.sourceIds, id];
    onChange({ ...filters, sourceIds: next });
  }

  function toggleFileType(ft: string) {
    const next = filters.fileTypes.includes(ft)
      ? filters.fileTypes.filter((t) => t !== ft)
      : [...filters.fileTypes, ft];
    onChange({ ...filters, fileTypes: next });
  }

  return (
    <div className="border-b border-obsidian-border/20 bg-obsidian-sunken shrink-0">
      {/* Toggle bar */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-controls="search-filter-panel"
          aria-label="Toggle search filters"
        >
          <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest">
            FILTERS
          </span>
          {activeCount > 0 && (
            <span className="font-mono text-[9px] text-phosphor uppercase tracking-wider bg-phosphor/10 border border-phosphor/20 px-1.5 py-0.5">
              {activeCount} ACTIVE
            </span>
          )}
          {expanded ? (
            <ChevronUp size={10} className="text-ui-dim" />
          ) : (
            <ChevronDown size={10} className="text-ui-dim" />
          )}
        </button>

        {activeCount > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 font-mono text-[9px] text-ui-dim hover:text-ui-muted uppercase tracking-wider transition-colors duration-100"
            aria-label="Clear all filters"
          >
            <X size={9} strokeWidth={2} />
            CLEAR ALL
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          id="search-filter-panel"
          className="px-4 pb-3 pt-1 grid grid-cols-3 gap-4 border-t border-obsidian-border/10"
        >
          {/* Source multi-select */}
          <div>
            <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mb-2">
              SOURCES
            </p>
            {sources.length === 0 ? (
              <span className="font-mono text-[9px] text-ui-dim uppercase">NONE INDEXED</span>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {sources.map((src) => {
                  const active = filters.sourceIds.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSourceId(src.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 w-full text-left font-mono text-[9px] uppercase tracking-wider transition-colors duration-100 ${
                        active ? 'text-phosphor' : 'text-ui-dim hover:text-ui-muted'
                      }`}
                    >
                      <span
                        className={`inline-block w-2 h-2 border shrink-0 ${
                          active ? 'bg-phosphor border-phosphor' : 'border-obsidian-border'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{src.filename}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* File type multi-select */}
          <div>
            <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mb-2">
              FILE TYPES
            </p>
            <div className="flex flex-wrap gap-1">
              {FILE_TYPE_OPTIONS.map((ft) => {
                const active = filters.fileTypes.includes(ft);
                return (
                  <button
                    key={ft}
                    onClick={() => toggleFileType(ft)}
                    aria-pressed={active}
                    className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border transition-all duration-100 ${
                      active
                        ? 'border-phosphor text-phosphor bg-phosphor/10'
                        : 'border-obsidian-border/40 text-ui-dim hover:border-obsidian-border hover:text-ui-muted'
                    }`}
                  >
                    {ft}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mb-2">
              DATE RANGE
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-ui-dim uppercase w-6 shrink-0">
                  FROM
                </span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                  aria-label="Filter from date"
                  className="flex-1 bg-obsidian-sunken border-b border-obsidian-border font-mono text-[9px] text-ui-text px-1 py-0.5 outline-none focus:border-phosphor transition-colors duration-100 uppercase"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-ui-dim uppercase w-6 shrink-0">TO</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                  aria-label="Filter to date"
                  className="flex-1 bg-obsidian-sunken border-b border-obsidian-border font-mono text-[9px] text-ui-text px-1 py-0.5 outline-none focus:border-phosphor transition-colors duration-100 uppercase"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
