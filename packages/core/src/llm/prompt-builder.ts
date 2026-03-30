import type { ChunkSearchResult, Message } from '@delve/shared';

const SYSTEM_PROMPT = `You are a knowledgeable assistant with access to a personal knowledge base. Your role is to answer questions accurately and concisely using only the information provided in the context below.

Guidelines:
- Base your answers exclusively on the provided context. Do not invent facts or draw from general knowledge when the context is sufficient.
- If the context does not contain enough information to answer the question, say clearly: "I don't have enough information in my knowledge base to answer that."
- Cite your sources inline using the labels provided (e.g., [Source 1], [Source 2]). Place citations immediately after the statement they support.
- When multiple sources support the same point, list all relevant citations: [Source 1][Source 3].
- Preserve the user's conversational tone — be direct and avoid unnecessary filler.
- Never fabricate source labels or reference sources that are not listed in the context.`;

const NOTE_CONTEXT_ADDENDUM = `
When the user asks about their notes (listing, summarizing, or querying by date/metadata), use the Notes section provided in the context to answer. List notes clearly with their titles, creation dates, and tags. Provide brief content summaries when available. If no notes were found for the requested time period, say so clearly.`;

/**
 * Formats a single ChunkSearchResult into a labelled context block.
 * The label is 1-based to match natural reading conventions.
 */
function formatContextBlock(result: ChunkSearchResult, index: number): string {
  const label = index + 1;
  const { filename } = result.source;
  const chunkNum = result.chunk.chunkIndex + 1;
  const header = `[Source ${label}: ${filename}, chunk ${chunkNum}]`;
  return `${header}\n${result.chunk.content.trim()}`;
}

/**
 * Converts a conversation Message to a simple "Role: content" line for
 * inclusion in the prompt history block.
 */
function formatHistoryTurn(message: Message): string {
  const role = message.role === 'user' ? 'User' : 'Assistant';
  return `${role}: ${message.content.trim()}`;
}

/**
 * Builds the full prompt and system prompt to send to the LLM.
 *
 * - `query` is the user's current question.
 * - `context` is the ranked set of retrieved chunks; each gets a labelled
 *   block so the model can cite them inline.
 * - `history` is the full conversation so far; only the most recent
 *   `maxHistoryTurns` turns are included to stay within context limits.
 * - `maxHistoryTurns` caps how many prior exchanges are prepended to the
 *   prompt (one turn = one user message + one assistant response).
 *
 * Returns separate `prompt` and `systemPrompt` strings to map cleanly onto
 * LLM APIs that distinguish between the two.
 */
export function buildPrompt(
  query: string,
  context: readonly ChunkSearchResult[],
  history: readonly Message[],
  maxHistoryTurns: number,
  noteContext?: string,
  persona?: string,
): { prompt: string; systemPrompt: string } {
  // --- Context block ---
  const contextSection =
    context.length === 0
      ? 'No relevant context was found in the knowledge base for this query.'
      : context.map((result, i) => formatContextBlock(result, i)).join('\n\n');

  // --- Conversation history ---
  // Filter to only user/assistant turns (drop any system messages), then take
  // the trailing N pairs. A "turn" is a user message plus the assistant reply
  // that follows it, so we limit to 2 * maxHistoryTurns raw messages.
  const conversationalMessages = history.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );
  const maxMessages = Math.max(0, maxHistoryTurns) * 2;
  const recentHistory =
    maxMessages > 0
      ? conversationalMessages.slice(-maxMessages)
      : [];

  const historySection =
    recentHistory.length === 0
      ? ''
      : [
          '--- Conversation History ---',
          ...recentHistory.map(formatHistoryTurn),
          '--- End of History ---',
        ].join('\n');

  // --- Assemble the full user-facing prompt ---
  const parts: string[] = [];

  // Note metadata context (from temporal/metadata queries) comes first
  if (noteContext) {
    parts.push(noteContext);
    parts.push('');
  }

  if (context.length > 0) {
    parts.push('--- Knowledge Base Context ---');
    parts.push(contextSection);
    parts.push('--- End of Context ---');
  } else if (!noteContext) {
    // Only show the "no context" message if we also have no note context
    parts.push(contextSection);
  }

  if (historySection !== '') {
    parts.push('');
    parts.push(historySection);
  }

  parts.push('');
  parts.push(`Question: ${query.trim()}`);

  const personaPrefix = persona?.trim() ? `${persona.trim()}\n\n` : '';
  const corePrompt = noteContext
    ? SYSTEM_PROMPT + NOTE_CONTEXT_ADDENDUM
    : SYSTEM_PROMPT;
  const systemPrompt = personaPrefix + corePrompt;

  return {
    systemPrompt,
    prompt: parts.join('\n'),
  };
}
