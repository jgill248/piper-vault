import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useListSources, useListTags } from '../../hooks/use-sources';
import { useActiveCollection } from '../../context/CollectionContext';

export interface SearchFilterState {
  sourceIds: string[];
  fileTypes: string[];
  tags: string[];
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: SearchFilterState = {
  sourceIds: [],
  fileTypes: [],
  tags: [],
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
  if (filters.tags.length > 0) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  return count;
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const { activeCollectionId } = useActiveCollection();
  const { data: sourcesData } = useListSources(1, 100, activeCollectionId);
  const { data: availableTags } = useListTags();
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

  function toggleTag(tag: string) {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  }

  return (
    <div className="border-b border-outline-variant/20 bg-surface-container shrink-0">
      {/* Toggle bar */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-controls="search-filter-panel"
          aria-label="Toggle search filters"
          title="Toggle search filters (sources, file types, tags, date range)"
        >
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            FILTERS
          </span>
          {activeCount > 0 && (
            <span className="font-label text-[9px] text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-1.5 py-0.5">
              {activeCount} ACTIVE
            </span>
          )}
          {expanded ? (
            <ChevronUp size={10} className="text-on-surface-variant" />
          ) : (
            <ChevronDown size={10} className="text-on-surface-variant" />
          )}
        </button>

        {activeCount > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 font-label text-[9px] text-on-surface-variant hover:text-secondary uppercase tracking-wider transition-colors duration-100"
            aria-label="Clear all filters"
          >
            <X size={9} strokeWidth={2} />
            CLEAR ALL
          </button>
        )}
      </div>

      {/* Active filter chips shown when collapsed */}
      {!expanded && activeCount > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-1.5 flex-wrap">
          {filters.fileTypes.map((ft) => (
            <span key={ft} className="font-label text-[8px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 uppercase tracking-wider">
              {ft}
            </span>
          ))}
          {filters.tags.map((tag) => (
            <span key={tag} className="font-label text-[8px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 uppercase tracking-wider">
              #{tag}
            </span>
          ))}
          {(filters.dateFrom || filters.dateTo) && (
            <span className="font-label text-[8px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 uppercase tracking-wider">
              {filters.dateFrom || '...'} — {filters.dateTo || '...'}
            </span>
          )}
          {filters.sourceIds.length > 0 && (
            <span className="font-label text-[8px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 uppercase tracking-wider">
              {filters.sourceIds.length} SOURCE{filters.sourceIds.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div
          id="search-filter-panel"
          className="px-4 pb-3 pt-1 grid grid-cols-4 gap-4 border-t border-outline-variant/10"
        >
          {/* Source multi-select */}
          <div>
            <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
              SOURCES
            </p>
            {sources.length === 0 ? (
              <span className="font-label text-[9px] text-on-surface-variant uppercase">NONE INDEXED</span>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {sources.map((src) => {
                  const active = filters.sourceIds.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSourceId(src.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 w-full text-left font-label text-[9px] uppercase tracking-wider transition-colors duration-100 ${
                        active ? 'text-primary' : 'text-on-surface-variant hover:text-secondary'
                      }`}
                    >
                      <span
                        className={`inline-block w-2 h-2 border shrink-0 ${
                          active ? 'bg-primary border-primary' : 'border-outline-variant'
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
            <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
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
                    className={`font-label text-[9px] uppercase tracking-wider px-2 py-0.5 border transition-all duration-100 ${
                      active
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant hover:text-secondary'
                    }`}
                  >
                    {ft}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags multi-select */}
          <div>
            <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
              TAGS
            </p>
            {(!availableTags || availableTags.length === 0) ? (
              <span className="font-label text-[9px] text-on-surface-variant uppercase">NO TAGS</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => {
                  const active = filters.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      aria-pressed={active}
                      className={`font-label text-[9px] uppercase tracking-wider px-2 py-0.5 border transition-all duration-100 ${
                        active
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant hover:text-secondary'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date range */}
          <div>
            <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
              DATE RANGE
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-label text-[9px] text-on-surface-variant uppercase w-6 shrink-0">
                  FROM
                </span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                  aria-label="Filter from date"
                  className="flex-1 bg-surface-container border-b border-outline-variant font-mono text-[9px] text-on-surface px-1 py-0.5 outline-none focus:border-primary transition-colors duration-100 uppercase"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label text-[9px] text-on-surface-variant uppercase w-6 shrink-0">TO</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                  aria-label="Filter to date"
                  className="flex-1 bg-surface-container border-b border-outline-variant font-mono text-[9px] text-on-surface px-1 py-0.5 outline-none focus:border-primary transition-colors duration-100 uppercase"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
