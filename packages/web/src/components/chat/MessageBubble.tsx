import ReactMarkdown from 'react-markdown';
import { User, Cpu, Sparkles } from 'lucide-react';
import type { Message } from '@delve/shared';
import { MESSAGE_ROLE } from '@delve/shared';
import { usePromoteToWiki } from '../../hooks/use-wiki';

interface MessageBubbleProps {
  message: Message;
  conversationId?: string;
  onSourceClick?: (sourceId: string) => void;
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  return isToday
    ? formatTime(d)
    : `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} ${formatTime(d)}`;
}

export function MessageBubble({ message, conversationId, onSourceClick }: MessageBubbleProps) {
  const isUser = message.role === MESSAGE_ROLE.USER;
  const isAssistant = message.role === MESSAGE_ROLE.ASSISTANT;
  const promoteMutation = usePromoteToWiki();

  const sourceNames = message.sourceNames;

  async function handlePromoteToWiki() {
    if (!conversationId) return;
    try {
      await promoteMutation.mutateAsync({ conversationId, messageId: message.id });
    } catch {
      // Error state handled by mutation
    }
  }

  const promoteStatus = promoteMutation.isPending
    ? 'loading'
    : promoteMutation.isSuccess
      ? 'done'
      : promoteMutation.isError
        ? 'error'
        : 'idle';

  return (
    <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Role label + timestamp */}
      <div
        className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {/* Role icon */}
        <span className={`shrink-0 ${isUser ? 'text-on-surface-variant' : 'text-primary'}`}>
          {isUser ? <User size={10} strokeWidth={1.5} /> : <Cpu size={10} strokeWidth={1.5} />}
        </span>
        <span
          className={`font-label text-[9px] uppercase tracking-widest ${
            isUser ? 'text-secondary' : 'text-primary'
          }`}
        >
          {isUser ? 'USER' : 'PIPER'}
        </span>
        <span className="font-label text-[9px] text-on-surface-variant">
          {formatTimestamp(message.createdAt)}
        </span>
      </div>

      {/* Message body */}
      <div
        className={`max-w-[80%] px-4 py-3 text-sm ${
          isUser
            ? 'bg-surface-container-high text-on-surface border-r-2 border-r-on-surface-variant/30'
            : 'bg-surface text-on-surface border-l-3 border-l-primary/50'
        }`}
      >
        {isUser ? (
          <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none font-body leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              components={{
                code({ children, className, ...props }) {
                  const isInline = !className;
                  return isInline ? (
                    <code
                      className="font-mono text-primary bg-surface-container px-1.5 py-0.5 text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code className="font-mono text-xs text-on-surface" {...props}>
                      {children}
                    </code>
                  );
                },
                pre({ children, ...props }) {
                  return (
                    <pre
                      className="bg-surface-container border border-outline-variant/30 p-3 overflow-x-auto font-mono text-xs my-2"
                      {...props}
                    >
                      {children}
                    </pre>
                  );
                },
                a({ children, href, ...props }) {
                  // Block javascript: and other dangerous URI schemes (CWE-79)
                  const safeHref =
                    href && /^(https?:|mailto:|#)/i.test(href) ? href : undefined;
                  return safeHref ? (
                    <a
                      href={safeHref}
                      className="text-primary underline underline-offset-2"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  ) : (
                    <span {...props}>{children}</span>
                  );
                },
                p({ children, ...props }) {
                  return (
                    <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
                      {children}
                    </p>
                  );
                },
                ul({ children, ...props }) {
                  return (
                    <ul className="list-disc list-inside mb-2 space-y-1" {...props}>
                      {children}
                    </ul>
                  );
                },
                ol({ children, ...props }) {
                  return (
                    <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>
                      {children}
                    </ol>
                  );
                },
                h1({ children, ...props }) {
                  return (
                    <h1 className="font-headline font-semibold text-base mb-2 text-on-surface" {...props}>
                      {children}
                    </h1>
                  );
                },
                h2({ children, ...props }) {
                  return (
                    <h2 className="font-headline font-semibold text-sm mb-2 text-on-surface" {...props}>
                      {children}
                    </h2>
                  );
                },
                h3({ children, ...props }) {
                  return (
                    <h3 className="font-headline font-medium text-sm mb-1 text-on-surface" {...props}>
                      {children}
                    </h3>
                  );
                },
                blockquote({ children, ...props }) {
                  return (
                    <blockquote
                      className="border-l-2 border-primary/40 pl-3 text-secondary italic my-2"
                      {...props}
                    >
                      {children}
                    </blockquote>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Source citations */}
      {isAssistant && message.sources && message.sources.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[80%]">
          <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest self-center">
            SOURCES:
          </span>
          {message.sources.map((sourceId, i) => {
            const displayName = sourceNames?.[i]
              ? (sourceNames[i].length > 20 ? sourceNames[i].slice(0, 20) + '...' : sourceNames[i])
              : sourceId.slice(0, 8);
            const fullName = sourceNames?.[i] ?? sourceId;
            return (
              <button
                key={sourceId}
                onClick={() => onSourceClick?.(sourceId)}
                className="font-label text-[9px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 uppercase tracking-wider cursor-pointer hover:bg-primary/20 transition-colors"
                title={`View source: ${fullName}`}
              >
                [{String(i + 1).padStart(2, '0')}] {displayName}
              </button>
            );
          })}
        </div>
      )}

      {/* Promote to wiki button */}
      {isAssistant && conversationId && (
        <div className="mt-1">
          <button
            onClick={handlePromoteToWiki}
            disabled={promoteStatus === 'loading' || promoteStatus === 'done'}
            className="flex items-center gap-1 font-label text-[9px] text-on-surface-variant hover:text-primary uppercase tracking-wider transition-colors disabled:opacity-40"
            title="Save this conversation as a wiki page"
          >
            <Sparkles size={10} strokeWidth={1.5} />
            {promoteStatus === 'idle' && 'SAVE_TO_WIKI'}
            {promoteStatus === 'loading' && 'GENERATING...'}
            {promoteStatus === 'done' && 'SAVED_TO_WIKI'}
            {promoteStatus === 'error' && 'FAILED — RETRY'}
          </button>
        </div>
      )}
    </div>
  );
}
