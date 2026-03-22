import { useState, useRef, useEffect } from 'react';
import { Loader2, MessageSquare, History } from 'lucide-react';
import type { Message } from '@delve/shared';
import { MESSAGE_ROLE } from '@delve/shared';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { ConversationHistory } from './ConversationHistory';
import { SearchFilters, EMPTY_FILTERS } from './SearchFilters';
import type { SearchFilterState } from './SearchFilters';
import { useConversations, useSendMessage, useConversation, useExportConversation } from '../../hooks/use-chat';
import { useActiveCollection } from '../../context/CollectionContext';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
      <div
        className="border border-phosphor/20 p-6 bg-obsidian-surface/50"
        style={{ boxShadow: 'inset 0 0 40px rgba(171,214,0,0.03)' }}
      >
        <MessageSquare size={32} className="text-phosphor/40" strokeWidth={1} />
      </div>
      <div className="text-center space-y-1">
        <p className="font-display font-semibold text-ui-text text-sm">No active session</p>
        <p className="font-mono text-[10px] text-ui-dim uppercase tracking-wider">
          Submit a query to initialize
        </p>
      </div>
    </div>
  );
}

export function ChatPanel() {
  const [inputValue, setInputValue] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilterState>(EMPTY_FILTERS);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { activeCollectionId } = useActiveCollection();
  const sendMessage = useSendMessage();
  const exportConversation = useExportConversation();
  const { data: conversation } = useConversation(activeConversationId);
  const { data: conversations } = useConversations(activeCollectionId);

  // Merge server messages with local optimistic messages
  const serverMessages: readonly Message[] = conversation?.messages ?? [];
  const messages: readonly Message[] =
    serverMessages.length > 0 ? serverMessages : localMessages;

  const activeConversationTitle = conversations?.find(
    (c) => c.id === activeConversationId,
  )?.title;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sendMessage.isPending]);

  function handleNewSession() {
    setActiveConversationId(undefined);
    setLocalMessages([]);
    setFollowUps([]);
  }

  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    setLocalMessages([]);
    setFollowUps([]);
  }

  function handleFollowUpClick(question: string) {
    setInputValue(question);
    setFollowUps([]);
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

  function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed || sendMessage.isPending) return;

    setFollowUps([]);

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

    sendMessage.mutate(
      { message: trimmed, conversationId: activeConversationId, collectionId: activeCollectionId, ...filters },
      {
        onSuccess: (data) => {
          setActiveConversationId(data.conversationId);
          setLocalMessages([]);
          setFollowUps(data.suggestedFollowUps ? [...data.suggestedFollowUps] : []);
        },
        onError: () => {
          setLocalMessages((prev) =>
            prev.filter((m) => m.id !== optimisticUserMsg.id),
          );
        },
      },
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation history sidebar */}
      {showHistory && (
        <ConversationHistory
          activeConversationId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewSession={handleNewSession}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border/20 bg-obsidian-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowHistory((v) => !v)}
              aria-label="Toggle conversation history"
              aria-expanded={showHistory}
              className={`p-1.5 transition-colors duration-100 shrink-0 ${
                showHistory
                  ? 'text-phosphor bg-phosphor/10'
                  : 'text-ui-dim hover:text-ui-muted'
              }`}
            >
              <History size={14} strokeWidth={1.5} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-ui-text text-sm truncate">
                {activeConversationTitle ?? 'Conversational Search'}
              </h1>
              <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mt-0.5">
                {activeConversationId
                  ? `SESSION: ${activeConversationId.slice(0, 8)}`
                  : 'RAG-POWERED · CITATION-BACKED'}
              </p>
            </div>
          </div>

          {activeConversationId && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExport}
                disabled={exportConversation.isPending}
                className="btn-secondary text-[10px] px-3 py-1.5"
                aria-label="Export conversation as markdown"
              >
                {exportConversation.isPending ? 'EXPORTING...' : 'EXPORT_'}
              </button>
              <button
                onClick={handleNewSession}
                className="btn-secondary text-[10px] px-3 py-1.5"
              >
                NEW SESSION_
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
          {messages.length === 0 && !sendMessage.isPending ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {/* Suggested follow-ups */}
              {followUps.length > 0 && !sendMessage.isPending && (
                <div className="flex flex-col gap-1.5 mb-4 max-w-[80%]">
                  <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest">
                    SUGGESTED FOLLOW-UPS
                  </span>
                  {followUps.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleFollowUpClick(q)}
                      className="text-left bg-obsidian-surface border border-obsidian-border/30 hover:border-phosphor/40 px-3 py-2 font-sans text-[12px] text-ui-muted hover:text-ui-text transition-all duration-100 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Pending indicator */}
              {sendMessage.isPending && (
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-obsidian-surface border-l-2 border-l-phosphor/40 px-4 py-3 flex items-center gap-2">
                    <Loader2
                      size={12}
                      className="animate-spin text-phosphor"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[10px] text-ui-dim uppercase tracking-widest">
                      PROCESSING...
                    </span>
                  </div>
                </div>
              )}

              {/* Error state */}
              {sendMessage.isError && (
                <div className="flex items-start mb-4">
                  <div className="bg-red-950/30 border-l-2 border-l-red-500 px-4 py-2">
                    <p className="font-mono text-[10px] text-red-400 uppercase tracking-wider">
                      ERROR: {sendMessage.error.message}
                    </p>
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
            disabled={sendMessage.isPending}
          />
        </div>
      </div>
    </div>
  );
}
