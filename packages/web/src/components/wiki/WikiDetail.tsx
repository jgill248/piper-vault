import { useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkWikiLinks } from '../notes/remark-wiki-links';
import { WikiLink } from '../notes/WikiLink';
import { useNote, useNotes } from '../../hooks/use-notes';
import { useActiveCollection } from '../../context/CollectionContext';
import { useNavigation } from '../../context/NavigationContext';

interface WikiDetailProps {
  readonly pageId: string;
  readonly onBack: () => void;
}

export function WikiDetail({ pageId, onBack }: WikiDetailProps) {
  const { data: page, isLoading, isError } = useNote(pageId);
  const { activeCollectionId } = useActiveCollection();
  const { navigateToNote } = useNavigation();

  // Build note name→id map for resolving wiki-links
  const allNotesQuery = useNotes({ collectionId: activeCollectionId, pageSize: 200 });
  const noteMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const note of allNotesQuery.data?.data ?? []) {
      const name = (note.title || note.filename).replace(/\.md$/, '');
      map.set(name.toLowerCase(), note.id);
    }
    return map;
  }, [allNotesQuery.data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WikiLinkRenderer = useCallback((props: any) => {
    const {
      targetFilename: tf,
      displayText: dt,
      section: sec,
    } = props.node?.properties ?? props;
    const id = noteMap.get((tf ?? '').toLowerCase());
    const resolved = id !== undefined;
    return (
      <WikiLink
        targetFilename={tf ?? ''}
        displayText={dt ?? null}
        section={sec ?? null}
        resolved={resolved}
        onClick={resolved ? () => navigateToNote(id) : undefined}
      />
    );
  }, [noteMap, navigateToNote]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
          LOADING_PAGE...
        </span>
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="text-center py-12">
        <span className="font-label text-[10px] text-error uppercase tracking-widest">
          PAGE_NOT_FOUND
        </span>
        <p className="font-body text-[11px] text-on-surface-variant mt-2">
          Could not load the wiki page.
        </p>
        <button
          onClick={onBack}
          className="font-label text-[10px] uppercase tracking-wider px-3 py-1.5 mt-4 border border-outline-variant/20 text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all duration-100"
        >
          BACK TO INDEX
        </button>
      </div>
    );
  }

  const title = page.title || page.filename;
  const tags = page.tags ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 bg-surface shrink-0">
        <button
          onClick={onBack}
          className="text-on-surface-variant hover:text-primary transition-colors"
          title="Back to index"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline text-sm font-semibold text-on-surface truncate">
            {title}
          </h2>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider px-1.5 py-0.5 bg-surface-container-high"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {page.linkCount > 0 && (
            <span className="font-label text-[9px] text-on-surface-variant" title="Outgoing links">
              {page.linkCount} links
            </span>
          )}
          {page.backlinkCount > 0 && (
            <span className="font-label text-[9px] text-secondary" title="Incoming references">
              {page.backlinkCount} backlinks
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="prose max-w-none text-on-surface prose-headings:text-on-surface prose-headings:font-headline prose-p:text-on-surface-variant prose-p:font-body prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-on-surface-variant prose-li:font-body prose-li:text-[13px] prose-td:text-on-surface-variant prose-th:text-on-surface prose-strong:text-on-surface prose-a:text-primary prose-hr:border-outline-variant/20">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkWikiLinks]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            components={{ 'wiki-link': WikiLinkRenderer } as any}
          >
            {page.content ?? ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
