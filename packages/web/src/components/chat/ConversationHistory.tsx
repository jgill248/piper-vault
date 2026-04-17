import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import type { Conversation } from '@delve/shared';
import { useConversations, useDeleteConversation } from '../../hooks/use-chat';

function getDateGroup(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  return 'Older';
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteConversation = useDeleteConversation();

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteConversation.mutate(conversation.id, {
      onSuccess: () => onDelete?.(conversation.id),
      onSettled: () => setConfirmDelete(false),
    });
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(false);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(conversation.id);
      }}
      className={`
        group relative flex flex-col gap-0.5 px-3 py-2.5 cursor-pointer
        border-l-2 transition-all duration-100
        ${
          isActive
            ? 'border-l-primary bg-primary/5'
            : 'border-l-transparent hover:border-l-outline-variant hover:bg-surface-container-high/20'
        }
      `}
    >
      {/* Active indicator glow */}
      {isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-container"
          aria-hidden="true"
        />
      )}

      <div className="flex items-start justify-between gap-2 pr-6 min-w-0">
        <span
          className={`font-body text-[11px] leading-snug truncate flex-1 min-w-0 ${
            isActive ? 'text-on-surface' : 'text-secondary group-hover:text-on-surface'
          }`}
          title={conversation.title}
        >
          {conversation.title}
        </span>
      </div>

      <span className="font-label text-[9px] text-on-surface-variant tabular-nums">
        {formatDate(conversation.updatedAt)}
      </span>

      {/* Delete action */}
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmDelete ? (
          <div className="flex items-center gap-1 bg-surface-container-high border border-outline-variant/30 px-1.5 py-0.5">
            <button
              onClick={handleDeleteClick}
              disabled={deleteConversation.isPending}
              aria-label="Confirm delete conversation"
              className="font-label text-[9px] text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors duration-100 disabled:cursor-not-allowed"
            >
              Y
            </button>
            <span className="font-label text-[9px] text-on-surface-variant">/</span>
            <button
              onClick={handleCancelDelete}
              aria-label="Cancel delete"
              className="font-label text-[9px] text-secondary hover:text-on-surface uppercase tracking-wider transition-colors duration-100"
            >
              N
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeleteClick}
            aria-label={`Delete conversation: ${conversation.title}`}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 text-on-surface-variant hover:text-red-400 transition-all duration-100 p-0.5"
          >
            <Trash2 size={10} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

interface ConversationHistoryProps {
  activeConversationId: string | undefined;
  collectionId?: string;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export function ConversationHistory({
  activeConversationId,
  collectionId,
  onSelect,
  onNewSession,
  onClose,
  onDelete,
}: ConversationHistoryProps) {
  const { data: conversations, isLoading } = useConversations(collectionId);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Group conversations by date
  const sorted = conversations
    ? [...conversations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    : [];

  const grouped = sorted.reduce<Record<string, Conversation[]>>((acc, conv) => {
    const group = getDateGroup(conv.updatedAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(conv);
    return acc;
  }, {});

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-background/60 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="fixed left-52 top-0 bottom-0 w-64 z-50 flex flex-col bg-surface border-r border-outline-variant/20 shadow-2xl animate-slide-in-left"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/20 shrink-0">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
            SESSIONS
          </span>
          <button
            onClick={onClose}
            aria-label="Close conversation history"
            title="Close conversation history"
            className="text-on-surface-variant hover:text-on-surface transition-colors duration-100 p-0.5"
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 py-2 border-b border-outline-variant/20 shrink-0">
          <button
            onClick={onNewSession}
            className="flex items-center gap-2 w-full btn-primary text-[10px] px-3 py-1.5 justify-center"
            aria-label="Start new session"
          >
            <Plus size={10} strokeWidth={2} />
            NEW SESSION
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest animate-pulse">
                LOADING...
              </span>
            </div>
          )}

          {!isLoading && (!conversations || conversations.length === 0) && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 px-3">
              <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider text-center">
                NO SESSIONS YET
              </span>
            </div>
          )}

          {!isLoading && conversations && conversations.length > 0 && (
            <div>
              {groupOrder
                .filter((group) => (grouped[group]?.length ?? 0) > 0)
                .map((group) => (
                  <div key={group}>
                    <div className="px-3 pt-3 pb-1">
                      <span className="font-label text-[8px] text-on-surface-variant uppercase tracking-widest">
                        {group}
                      </span>
                    </div>
                    {(grouped[group] ?? []).map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === activeConversationId}
                        onSelect={onSelect}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
