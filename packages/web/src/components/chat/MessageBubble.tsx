import ReactMarkdown from 'react-markdown';
import type { Message } from '@delve/shared';
import { MESSAGE_ROLE } from '@delve/shared';

interface MessageBubbleProps {
  message: Message;
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

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === MESSAGE_ROLE.USER;
  const isAssistant = message.role === MESSAGE_ROLE.ASSISTANT;

  return (
    <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Role label + timestamp */}
      <div
        className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <span
          className={`font-mono text-[9px] uppercase tracking-widest ${
            isUser ? 'text-ui-muted' : 'text-phosphor'
          }`}
        >
          {isUser ? 'USER' : 'DELVE'}
        </span>
        <span className="font-mono text-[9px] text-ui-dim">
          {formatTimestamp(message.createdAt)}
        </span>
      </div>

      {/* Message body */}
      <div
        className={`max-w-[80%] px-4 py-3 text-sm ${
          isUser
            ? 'bg-obsidian-raised text-ui-text border-r-2 border-r-ui-dim/30'
            : 'bg-obsidian-surface text-ui-text border-l-2 border-l-phosphor/40'
        }`}
      >
        {isUser ? (
          <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none font-sans leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              components={{
                code({ children, className, ...props }) {
                  const isInline = !className;
                  return isInline ? (
                    <code
                      className="font-mono text-phosphor bg-obsidian-sunken px-1.5 py-0.5 text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code className="font-mono text-xs text-ui-text" {...props}>
                      {children}
                    </code>
                  );
                },
                pre({ children, ...props }) {
                  return (
                    <pre
                      className="bg-obsidian-sunken border border-obsidian-border/30 p-3 overflow-x-auto font-mono text-xs my-2"
                      {...props}
                    >
                      {children}
                    </pre>
                  );
                },
                a({ children, href, ...props }) {
                  return (
                    <a
                      href={href}
                      className="text-phosphor underline underline-offset-2"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
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
                    <h1 className="font-display font-semibold text-base mb-2 text-ui-text" {...props}>
                      {children}
                    </h1>
                  );
                },
                h2({ children, ...props }) {
                  return (
                    <h2 className="font-display font-semibold text-sm mb-2 text-ui-text" {...props}>
                      {children}
                    </h2>
                  );
                },
                h3({ children, ...props }) {
                  return (
                    <h3 className="font-display font-medium text-sm mb-1 text-ui-text" {...props}>
                      {children}
                    </h3>
                  );
                },
                blockquote({ children, ...props }) {
                  return (
                    <blockquote
                      className="border-l-2 border-phosphor/40 pl-3 text-ui-muted italic my-2"
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
          <span className="font-mono text-[9px] text-ui-dim uppercase tracking-widest self-center">
            SOURCES:
          </span>
          {message.sources.map((sourceId, i) => (
            <span
              key={sourceId}
              className="font-mono text-[9px] text-phosphor bg-phosphor/10 border border-phosphor/20 px-2 py-0.5 uppercase tracking-wider"
            >
              [{String(i + 1).padStart(2, '0')}] {sourceId.slice(0, 8)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
