import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, MessageSquare, History, Trash2, Search, BookOpen, Lightbulb, ArrowRight } from 'lucide-react';
import type { Message } from '@delve/shared';
import { MESSAGE_ROLE } from '@delve/shared';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { ConversationHistory } from './ConversationHistory';
import { SearchFilters, EMPTY_FILTERS } from './SearchFilters';
import type { SearchFilterState } from './SearchFilters';
import { useConversations, useConversation, useExportConversation, useDeleteConversation } from '../../hooks/use-chat';
import { useActiveCollection } from '../../context/CollectionContext';
import { usePersistedConversationId } from '../../hooks/use-persisted-conversation';
import { useVaultStatus } from '../../hooks/use-vault-status';
import { useNavigation } from '../../context/NavigationContext';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

const STARTER_QUERIES = [
  { icon: <Search size={12} strokeWidth={1.5} />, text: 'What topics are covered in my knowledge base?' },
  { icon: <BookOpen size={12} strokeWidth={1.5} />, text: 'Summarize my most recent documents' },
  { icon: <Lightbulb size={12} strokeWidth={1.5} />, text: 'What are the key takeaways from my sources?' },
];

interface EmptyStateProps {
  onQuerySelect: (query: string) => void;
}

function EmptyState({ onQuerySelect }: EmptyStateProps) {
  const { isEmpty } = useVaultStatus();
  const nav = useNavigation();

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 select-none px-4">
        <div className="border border-primary/20 p-6 bg-surface/50">
          <MessageSquare size={32} className="text-primary/40" strokeWidth={1} />
        </div>
        <div className="text-center space-y-2">
          <p className="font-headline font-semibold text-on-surface text-sm">Your vault is empty</p>
          <p className="font-body text-[12px] text-on-surface-variant max-w-sm">
            Import documents or create notes first, then search your knowledge here.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => nav.navigate('sources')} className="btn-primary text-[10px] px-4 py-2">
            IMPORT SOURCES
          </button>
          <button onClick={() => nav.navigate('notes')} className="btn-secondary text-[10px] px-4 py-2">
            CREATE NOTES
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 select-none px-4">
      <div className="border border-primary/20 p-6 bg-surface/50">
        <MessageSquare size={32} className="text-primary/40" strokeWidth={1} />
      </div>
      <div className="text-center space-y-1">
        <p className="font-headline font-semibold text-on-surface text-sm">No active session</p>
        <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">
          Submit a query or try a suggestion below
        </p>
      </div>

      {/* Starter queries */}
      <div className="flex flex-col gap-2 w-full max-w-md">
        {STARTER_QUERIES.map((q, i) => (
          <button
            key={i}
            onClick={() => onQuerySelect(q.text)}
            className="flex items-center gap-3 text-left bg-surface border border-outline-variant/30 hover:border-primary/40 px-4 py-3 transition-all duration-100 cursor-pointer group"
          >
            <span className="text-on-surface-variant group-hover:text-primary transition-colors duration-100 shrink-0">
              {q.icon}
            </span>
            <span className="font-body text-[12px] text-secondary group-hover:text-on-surface transition-colors duration-100 flex-1">
              {q.text}
            </span>
            <ArrowRight size={10} className="text-on-surface-variant group-hover:text-primary transition-colors duration-100 shrink-0 opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const [inputValue, setInputValue] = useState('');
  const [activeConversationId, setActiveConversationId] = usePersistedConversationId();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const nav = useNavigation();
  const [searchFilters, setSearchFilters] = useState<SearchFilterState>(EMPTY_FILTERS);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCollectionRef = useRef(undefined as string | undefined);
  const isNewSessionRef = useRef(false);

  const { activeCollectionId } = useActiveCollection();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const exportConversation = useExportConversation();
  const deleteConversation = useDeleteConversation();
  const { data: conversation, isError: conversationError } = useConversation(activeConversationId);
  const { data: conversations } = useConversations(activeCollectionId);

  // Merge server messages with local optimistic messages + streaming content.
  const serverMessages: readonly Message[] = conversation?.messages ?? [];
  const serverIds = new Set(serverMessages.map((m) => m.id));
  const pendingLocal = localMessages.filter((m) => !serverIds.has(m.id));

  // Build the streaming assistant message if we're actively streaming
  const streamingMsg: Message | null =
    isStreaming && streamingContent
      ? {
          id: 'streaming',
          conversationId: activeConversationId ?? '',
          role: MESSAGE_ROLE.ASSISTANT,
          content: streamingContent,
          createdAt: new Date(),
        }
      : null;

  const allMessages: readonly Message[] = [
    ...(serverMessages.length > 0 ? serverMessages : []),
    ...pendingLocal,
    ...(streamingMsg ? [streamingMsg] : []),
  ];

  const activeConversationTitle = conversations?.find(
    (c) => c.id === activeConversationId,
  )?.title;

  const handleSourceClick = useCallback(
    (_sourceId: string) => {
      nav.navigate('sources');
    },
    [nav],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, isStreaming, streamingContent]);

  // Auto-load most recent conversation when mounting with no stored ID
  useEffect(() => {
    if (isNewSessionRef.current) return;
    if (!activeConversationId && conversations && conversations.length > 0) {
      const sorted = [...conversations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      if (sorted[0]) {
        setActiveConversationId(sorted[0].id);
      }
    }
  }, [activeConversationId, conversations, setActiveConversationId]);

  // Clear stale conversation ID if it no longer exists
  useEffect(() => {
    if (activeConversationId && conversationError) {
      setActiveConversationId(undefined);
    }
  }, [activeConversationId, conversationError, setActiveConversationId]);

  // Clear stored conversation when collection changes
  useEffect(() => {
    if (prevCollectionRef.current !== undefined && prevCollectionRef.current !== activeCollectionId) {
      setActiveConversationId(undefined);
    }
    prevCollectionRef.current = activeCollectionId;
  }, [activeCollectionId, setActiveConversationId]);

  function handleNewSession() {
    isNewSessionRef.current = true;
    setActiveConversationId(undefined);
    setLocalMessages([]);
    setFollowUps([]);
    setConfirmDelete(false);
  }

  function handleSelectConversation(id: string) {
    isNewSessionRef.current = false;
    setActiveConversationId(id);
    setLocalMessages([]);
    setFollowUps([]);
    setConfirmDelete(false);
    setShowHistory(false);
  }

  function handleFollowUpClick(question: string) {
    setInputValue(question);
    setFollowUps([]);
  }

  function handleStarterQuery(query: string) {
    setInputValue(query);
  }

  function handleDeleteConversation() {
    if (!activeConversationId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteConversation.mutate(activeConversationId, {
      onSuccess: () => {
        setActiveConversationId(undefined);
        setLocalMessages([]);
        setFollowUps([]);
        setConfirmDelete(false);
      },
      onSettled: () => setConfirmDelete(false),
    });
  }

  function handleCancelDelete() {
    setConfirmDelete(false);
  }

  function handleSidebarDelete(id: string) {
    if (id === activeConversationId) {
      setActiveConversationId(undefined);
      setLocalMessages([]);
      setFollowUps([]);
      setConfirmDelete(false);
    }
  }

  function handleExport() {
    if (!activeConversationId) return;
    exportConversation.mutate(activeConversationId, {
      onSuccess: (markdown) => {
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${activeConversationId.slice(0, 8)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    let resolvedConvId: string | undefined = activeConversationId;

    setFollowUps([]);
    setStreamError(null);
    setStreamingContent('');

    const optimisticUserMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: activeConversationId ?? '',
      role: MESSAGE_ROLE.USER,
      content: trimmed,
      createdAt: new Date(),
    };
    setLocalMessages((prev) => [...prev, optimisticUserMsg]);
    setInputValue('');

    // Build filters — only include non-empty values
    const filters: Record<string, unknown> = {};
    if (searchFilters.sourceIds.length > 0) filters.sourceIds = searchFilters.sourceIds;
    if (searchFilters.fileTypes.length > 0) filters.fileTypes = searchFilters.fileTypes;
    if (searchFilters.tags.length > 0) filters.tags = searchFilters.tags;
    if (searchFilters.dateFrom) filters.dateFrom = new Date(searchFilters.dateFrom).toISOString();
    if (searchFilters.dateTo) filters.dateTo = new Date(searchFilters.dateTo).toISOString();

    setIsStreaming(true);

    try {
      for await (const event of api.sendMessageStream({
        message: trimmed,
        conversationId: activeConversationId,
        collectionId: activeCollectionId,
        ...filters,
      })) {
        switch (event.type) {
          case 'meta':
            isNewSessionRef.current = false;
            resolvedConvId = event.conversationId;
            setActiveConversationId(event.conversationId);
            break;
          case 'delta':
            setStreamingContent((prev) => prev + event.content);
            break;
          case 'error':
            setStreamError(event.message);
            break;
          case 'done':
            // Stream complete — invalidate queries to load persisted messages
            void queryClient.invalidateQueries({ queryKey: ['conversations'] });
            void queryClient.invalidateQueries({
              queryKey: ['conversation', resolvedConvId],
            });
            break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStreamError(msg);
      setLocalMessages((prev) =>
        prev.filter((m) => m.id !== optimisticUserMsg.id),
      );
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setLocalMessages([]);
      // Re-invalidate to pick up the final persisted conversation
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (resolvedConvId) {
        void queryClient.invalidateQueries({
          queryKey: ['conversation', resolvedConvId],
        });
      }
    }
  }, [inputValue, isStreaming, activeConversationId, activeCollectionId, searchFilters, queryClient, setActiveConversationId]);

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Conversation history overlay */}
      {showHistory && (
        <ConversationHistory
          activeConversationId={activeConversationId}
          collectionId={activeCollectionId}
          onSelect={handleSelectConversation}
          onNewSession={handleNewSession}
          onClose={() => setShowHistory(false)}
          onDelete={handleSidebarDelete}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 bg-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowHistory((v) => !v)}
              aria-label="Toggle conversation history"
              aria-expanded={showHistory}
              title="Show conversation history"
              className={`p-1.5 transition-colors duration-100 shrink-0 ${
                showHistory
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface-variant hover:text-secondary'
              }`}
            >
              <History size={14} strokeWidth={1.5} />
            </button>
            <div className="min-w-0">
              <h1
                className="font-headline font-semibold text-on-surface text-sm truncate"
                title={activeConversationTitle ?? 'Conversational Search'}
              >
                {activeConversationTitle ?? 'Conversational Search'}
              </h1>
              <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mt-0.5">
                {activeConversationId
                  ? `SESSION: ${activeConversationId.slice(0, 8)}`
                  : 'RAG-POWERED · CITATION-BACKED'}
              </p>
            </div>
          </div>

          {activeConversationId && (
            <div className="flex items-center gap-2 shrink-0">
              {confirmDelete ? (
                <div className="flex items-center gap-1 border border-red-500/30 bg-red-950/20 px-2 py-1.5">
                  <span className="font-label text-[9px] text-red-400 uppercase tracking-wider mr-1">
                    DELETE?
                  </span>
                  <button
                    onClick={handleDeleteConversation}
                    disabled={deleteConversation.isPending}
                    aria-label="Confirm delete conversation"
                    className="font-label text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors duration-100 disabled:cursor-not-allowed"
                  >
                    Y
                  </button>
                  <span className="font-label text-[9px] text-on-surface-variant">/</span>
                  <button
                    onClick={handleCancelDelete}
                    aria-label="Cancel delete"
                    className="font-label text-[10px] text-secondary hover:text-on-surface uppercase tracking-wider transition-colors duration-100"
                  >
                    N
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleDeleteConversation}
                  className="btn-secondary text-[10px] px-2 py-1.5 hover:text-red-400 hover:border-red-500/30 transition-colors duration-100"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={exportConversation.isPending}
                className="btn-secondary text-[10px] px-3 py-1.5"
                aria-label="Export conversation as markdown"
                title="Export conversation as markdown"
              >
                {exportConversation.isPending ? 'EXPORTING...' : 'EXPORT'}
              </button>
              <button
                onClick={handleNewSession}
                className="btn-secondary text-[10px] px-3 py-1.5"
                title="Start a new chat session"
              >
                NEW SESSION
              </button>
            </div>
          )}
        </div>

        {/* Search filters */}
        <SearchFilters filters={searchFilters} onChange={setSearchFilters} />

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          role="log"
          aria-live="polite"
          aria-label="Conversation messages"
        >
          {allMessages.length === 0 && !isStreaming ? (
            <EmptyState onQuerySelect={handleStarterQuery} />
          ) : (
            <>
              {allMessages.map((message) => (
                <MessageBubble key={message.id} message={message} onSourceClick={handleSourceClick} />
              ))}

              {/* Suggested follow-ups */}
              {followUps.length > 0 && !isStreaming && (
                <div className="flex flex-col gap-1.5 mb-4 max-w-[80%]">
                  <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
                    SUGGESTED FOLLOW-UPS
                  </span>
                  {followUps.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleFollowUpClick(q)}
                      className="text-left bg-surface border border-outline-variant/30 hover:border-primary/40 px-3 py-2 font-body text-[12px] text-secondary hover:text-on-surface transition-all duration-100 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Streaming indicator (before content starts) */}
              {isStreaming && !streamingContent && (
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-surface border-l-2 border-l-primary/40 px-4 py-3 flex items-center gap-2">
                    <Loader2
                      size={12}
                      className="animate-spin text-primary"
                      aria-hidden="true"
                    />
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
                      THINKING...
                    </span>
                  </div>
                </div>
              )}

              {/* Error state */}
              {streamError && (
                <div className="flex items-start mb-4">
                  <div className="bg-red-950/30 border-l-2 border-l-red-500 px-4 py-2 space-y-1">
                    <p className="font-label text-[10px] text-red-400 uppercase tracking-wider">
                      ERROR: {streamError}
                    </p>
                    {/fetch|network|timeout|failed/i.test(streamError) && (
                      <p className="font-label text-[9px] text-red-400/70 uppercase tracking-wider">
                        If using Ollama, the model may still be loading — retry in a moment
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
