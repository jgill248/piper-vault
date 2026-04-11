import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Pencil, Eye, RotateCcw, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkWikiLinks } from '../notes/remark-wiki-links';
import { WikiLink } from '../notes/WikiLink';
import { NoteEditor } from '../notes/NoteEditor';
import { useNote, useNotes, useUpdateNote } from '../../hooks/use-notes';
import { useRegenerateWikiPage } from '../../hooks/use-wiki';
import { useActiveCollection } from '../../context/CollectionContext';
import { useNavigation } from '../../context/NavigationContext';

type ViewMode = 'view' | 'edit' | 'regenerate-preview';

interface WikiDetailProps {
  readonly pageId: string;
  readonly onBack: () => void;
  readonly onNavigateToPage?: (pageId: string) => void;
}

export function WikiDetail({ pageId, onBack, onNavigateToPage }: WikiDetailProps) {
  const { data: page, isLoading, isError } = useNote(pageId);
  const { activeCollectionId } = useActiveCollection();
  const { navigateToNote } = useNavigation();
  const updateNote = useUpdateNote();
  const regenerateMutation = useRegenerateWikiPage();

  const [mode, setMode] = useState<ViewMode>('view');
  const [regeneratePreview, setRegeneratePreview] = useState<{
    currentContent: string;
    proposedContent: string;
  } | null>(null);

  // Build note name→id map for resolving wiki-links
  const allNotesQuery = useNotes({ collectionId: activeCollectionId, pageSize: 200 });
  const { noteMap, noteNames, wikiPageIds } = useMemo(() => {
    const map = new Map<string, string>();
    const names: string[] = [];
    const wikiIds = new Set<string>();
    for (const note of allNotesQuery.data?.data ?? []) {
      const name = (note.title || note.filename).replace(/\.md$/, '');
      map.set(name.toLowerCase(), note.id);
      names.push(name);
      if (note.isGenerated) wikiIds.add(note.id);
    }
    return { noteMap: map, noteNames: names, wikiPageIds: wikiIds };
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
        onClick={resolved
          ? () => {
              if (onNavigateToPage && wikiPageIds.has(id)) {
                onNavigateToPage(id);
              } else {
                navigateToNote(id);
              }
            }
          : undefined
        }
      />
    );
  }, [noteMap, wikiPageIds, navigateToNote, onNavigateToPage]);

  const handleSave = useCallback((content: string, title: string) => {
    updateNote.mutate({ id: pageId, content, title });
  }, [pageId, updateNote]);

  const handleRegenerate = useCallback(async () => {
    const result = await regenerateMutation.mutateAsync({ pageId, preview: true });
    if (result.ok && result.value && 'proposedContent' in result.value) {
      setRegeneratePreview(result.value);
      setMode('regenerate-preview');
    }
  }, [pageId, regenerateMutation]);

  const handleApplyRegenerate = useCallback(async () => {
    await regenerateMutation.mutateAsync({ pageId, preview: false });
    setRegeneratePreview(null);
    setMode('view');
  }, [pageId, regenerateMutation]);

  const handleCancelRegenerate = useCallback(() => {
    setRegeneratePreview(null);
    setMode('view');
  }, []);

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
          <div className="flex items-center gap-1.5 mt-0.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="font-label text-[8px] text-on-surface-variant uppercase tracking-wider px-1.5 py-0.5 bg-surface-container-high"
              >
                {tag}
              </span>
            ))}
            {page.userReviewed && (
              <span className="font-label text-[8px] text-primary uppercase tracking-wider px-1.5 py-0.5 bg-primary/10">
                REVIEWED
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

          {/* Edit toggle */}
          <button
            onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
            className={`p-1 transition-colors ${
              mode === 'edit'
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
            title={mode === 'edit' ? 'View mode' : 'Edit page'}
          >
            {mode === 'edit' ? <Eye size={14} strokeWidth={1.5} /> : <Pencil size={14} strokeWidth={1.5} />}
          </button>

          {/* Regenerate button — only for generated pages */}
          {page.isGenerated && (
            <button
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending || mode === 'regenerate-preview'}
              className="font-label text-[9px] uppercase tracking-wider px-2 py-1 text-on-surface-variant hover:text-primary border border-outline-variant/20 hover:border-primary/30 transition-all duration-100 disabled:opacity-50"
              title="Regenerate from sources"
            >
              {regenerateMutation.isPending ? (
                <span className="animate-pulse">REGENERATING...</span>
              ) : (
                <span className="flex items-center gap-1">
                  <RotateCcw size={10} strokeWidth={1.5} />
                  REGENERATE
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'edit' ? (
          <div className="h-full">
            <NoteEditor
              noteId={pageId}
              initialContent={page.content ?? ''}
              initialTitle={typeof title === 'string' ? title : ''}
              onSave={handleSave}
              noteNames={noteNames}
              noteMap={noteMap}
              onNavigateToNote={navigateToNote}
            />
          </div>
        ) : mode === 'regenerate-preview' && regeneratePreview ? (
          <div className="flex flex-col h-full">
            {/* Regenerate preview header */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface-container-high border-b border-outline-variant/20">
              <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
                REGENERATION PREVIEW
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyRegenerate}
                  disabled={regenerateMutation.isPending}
                  className="flex items-center gap-1 font-label text-[9px] uppercase tracking-wider px-2 py-1 text-primary border border-primary/30 hover:bg-primary/5 transition-all duration-100 disabled:opacity-50"
                >
                  <Check size={10} strokeWidth={1.5} />
                  {regenerateMutation.isPending ? 'APPLYING...' : 'APPLY'}
                </button>
                <button
                  onClick={handleCancelRegenerate}
                  className="flex items-center gap-1 font-label text-[9px] uppercase tracking-wider px-2 py-1 text-on-surface-variant border border-outline-variant/20 hover:text-error hover:border-error/30 transition-all duration-100"
                >
                  <X size={10} strokeWidth={1.5} />
                  CANCEL
                </button>
              </div>
            </div>
            {/* Side-by-side diff view */}
            <div className="flex-1 grid grid-cols-2 divide-x divide-outline-variant/20 overflow-hidden">
              <div className="overflow-y-auto px-4 py-3">
                <div className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
                  CURRENT
                </div>
                <div className="prose max-w-none text-on-surface prose-headings:text-on-surface prose-headings:font-headline prose-p:text-on-surface-variant prose-p:font-body prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-on-surface-variant prose-li:font-body prose-li:text-[13px] prose-td:text-on-surface-variant prose-th:text-on-surface prose-strong:text-on-surface prose-a:text-primary prose-hr:border-outline-variant/20">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkWikiLinks]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    components={{ 'wiki-link': WikiLinkRenderer } as any}
                  >
                    {regeneratePreview.currentContent}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="overflow-y-auto px-4 py-3 bg-surface-container">
                <div className="font-label text-[9px] text-primary uppercase tracking-widest mb-2">
                  PROPOSED
                </div>
                <div className="prose max-w-none text-on-surface prose-headings:text-on-surface prose-headings:font-headline prose-p:text-on-surface-variant prose-p:font-body prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-on-surface-variant prose-li:font-body prose-li:text-[13px] prose-td:text-on-surface-variant prose-th:text-on-surface prose-strong:text-on-surface prose-a:text-primary prose-hr:border-outline-variant/20">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkWikiLinks]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    components={{ 'wiki-link': WikiLinkRenderer } as any}
                  >
                    {regeneratePreview.proposedContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
            {/* Source provenance summary */}
            {page.isGenerated && page.generationSourceIds.length > 0 && (
              <div className="mb-3 font-label text-[9px] text-on-surface-variant uppercase tracking-wider">
                Synthesized from {page.generationSourceIds.length} source{page.generationSourceIds.length !== 1 ? 's' : ''}
              </div>
            )}
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
        )}
      </div>
    </div>
  );
}
