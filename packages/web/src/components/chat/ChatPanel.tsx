import { useState, useRef, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import type { Message } from '@delve/shared';
import { MESSAGE_ROLE } from '@delve/shared';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { useConversations, useSendMessage, useConversation } from '../../hooks/use-chat';

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

interface ConversationSelectorProps {
  activeId: string | undefined;
  onSelect: (id: string) => void;
}

function ConversationSelector({ activeId, onSelect }: ConversationSelectorProps) {
  const { data: conversations, isLoading } = useConversations();

  if (isLoading || !conversations || conversations.length === 0) return null;

  return (
    <div className="border-b border-obsidian-border/20 bg-obsidian-surface px-4 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest shrink-0">
        SESSION:
      </span>
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`font-mono text-[10px] px-2.5 py-1 uppercase tracking-wider border shrink-0 transition-colors duration-100 ${
            activeId === conv.id
              ? 'border-phosphor/50 text-phosphor bg-phosphor/10'
              : 'border-obsidian-border/40 text-ui-muted hover:border-obsidian-border hover:text-ui-text'
          }`}
        >
          {conv.title.slice(0, 24)}
          {conv.title.length > 24 ? '...' : ''}
        </button>
      ))}
    </div>
  );
}

export function ChatPanel() {
  const [inputValue, setInputValue] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useSendMessage();
  const { data: conversation } = useConversation(activeConversationId);

  // Merge server messages with local optimistic messages
  const serverMessages: readonly Message[] = conversation?.messages ?? [];
  const messages: readonly Message[] =
    serverMessages.length > 0 ? serverMessages : localMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sendMessage.isPending]);

  function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed || sendMessage.isPending) return;

    // Optimistic user message
    const optimisticUserMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: activeConversationId ?? '',
      role: MESSAGE_ROLE.USER,
      content: trimmed,
      createdAt: new Date(),
    };
    setLocalMessages((prev) => [...prev, optimisticUserMsg]);
    setInputValue('');

    sendMessage.mutate(
      { message: trimmed, conversationId: activeConversationId },
      {
        onSuccess: (data) => {
          setActiveConversationId(data.conversationId);
          // Once we have a real conversation, clear local messages
          // (the useConversation hook will fetch the real ones)
          setLocalMessages([]);
        },
        onError: () => {
          // Remove optimistic message on error
          setLocalMessages((prev) =>
            prev.filter((m) => m.id !== optimisticUserMsg.id),
          );
        },
      },
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border/20 bg-obsidian-surface shrink-0">
        <div>
          <h1 className="font-display font-semibold text-ui-text text-sm">Conversational Search</h1>
          <p className="font-mono text-[9px] text-ui-dim uppercase tracking-widest mt-0.5">
            RAG-POWERED · CITATION-BACKED
          </p>
        </div>
        {activeConversationId && (
          <button
            onClick={() => {
              setActiveConversationId(undefined);
              setLocalMessages([]);
            }}
            className="btn-secondary text-[10px] px-3 py-1.5"
          >
            NEW SESSION_
          </button>
        )}
      </div>

      {/* Conversation selector */}
      <ConversationSelector
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversation messages">
        {messages.length === 0 && !sendMessage.isPending ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

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
  );
}
