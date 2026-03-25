/**
 * Lightweight regex-based query intent detector.
 *
 * Analyses a user's chat query and determines whether it is:
 * - `semantic`  — standard RAG search (default)
 * - `metadata`  — a listing/summary of notes filtered by date (no content search)
 * - `hybrid`    — date-filtered semantic search combined with note metadata
 *
 * This avoids an LLM round-trip on the hot path; the closed set of temporal
 * patterns is handled reliably by regex.  Can be upgraded to an LLM classifier
 * when Phase 6 (Agentic RAG) lands.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QueryIntentType = 'semantic' | 'metadata' | 'hybrid';

export interface TemporalRange {
  readonly dateFrom: string; // ISO-8601
  readonly dateTo: string;   // ISO-8601
}

export interface QueryIntent {
  readonly type: QueryIntentType;
  readonly temporal?: TemporalRange;
  readonly wantsNotes?: boolean;
  readonly contentQuery?: string;
  readonly dateField?: 'created_at' | 'updated_at';
  readonly dateLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(23, 59, 59, 999);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/** Monday = start of week (ISO). */
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  r.setUTCDate(r.getUTCDate() - diff);
  return startOfDay(r);
}

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setUTCDate(1);
  return startOfDay(r);
}

function endOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + 1, 0); // last day of current month
  return endOfDay(r);
}

function toISO(d: Date): string {
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Pattern matchers
// ---------------------------------------------------------------------------

interface TemporalMatch {
  range: TemporalRange;
  label: string;
  /** The substring that matched, so we can strip it for content extraction. */
  matched: string;
}

type TemporalMatcher = (query: string, now: Date) => TemporalMatch | null;

const TEMPORAL_MATCHERS: TemporalMatcher[] = [
  // "today"
  (q, now) => {
    const m = q.match(/\btoday\b/i);
    if (!m) return null;
    return {
      range: { dateFrom: toISO(startOfDay(now)), dateTo: toISO(endOfDay(now)) },
      label: 'today',
      matched: m[0],
    };
  },

  // "yesterday"
  (q, now) => {
    const m = q.match(/\byesterday\b/i);
    if (!m) return null;
    const y = addDays(now, -1);
    return {
      range: { dateFrom: toISO(startOfDay(y)), dateTo: toISO(endOfDay(y)) },
      label: 'yesterday',
      matched: m[0],
    };
  },

  // "this week"
  (q, now) => {
    const m = q.match(/\bthis\s+week\b/i);
    if (!m) return null;
    return {
      range: { dateFrom: toISO(startOfWeek(now)), dateTo: toISO(endOfDay(now)) },
      label: 'this week',
      matched: m[0],
    };
  },

  // "last week"
  (q, now) => {
    const m = q.match(/\blast\s+week\b/i);
    if (!m) return null;
    const prevWeekStart = addDays(startOfWeek(now), -7);
    const prevWeekEnd = addDays(startOfWeek(now), -1);
    return {
      range: { dateFrom: toISO(startOfDay(prevWeekStart)), dateTo: toISO(endOfDay(prevWeekEnd)) },
      label: 'last week',
      matched: m[0],
    };
  },

  // "last N days" / "past N days"
  (q, now) => {
    const m = q.match(/\b(?:last|past)\s+(\d+)\s+days?\b/i);
    if (!m) return null;
    const n = parseInt(m[1] ?? '0', 10);
    if (isNaN(n) || n <= 0 || n > 365) return null;
    return {
      range: { dateFrom: toISO(startOfDay(addDays(now, -n))), dateTo: toISO(endOfDay(now)) },
      label: `past ${n} day${n === 1 ? '' : 's'}`,
      matched: m[0],
    };
  },

  // "this month"
  (q, now) => {
    const m = q.match(/\bthis\s+month\b/i);
    if (!m) return null;
    return {
      range: { dateFrom: toISO(startOfMonth(now)), dateTo: toISO(endOfDay(now)) },
      label: 'this month',
      matched: m[0],
    };
  },

  // "last month"
  (q, now) => {
    const m = q.match(/\blast\s+month\b/i);
    if (!m) return null;
    const prevMonth = new Date(now);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    return {
      range: { dateFrom: toISO(startOfMonth(prevMonth)), dateTo: toISO(endOfMonth(prevMonth)) },
      label: 'last month',
      matched: m[0],
    };
  },
];

// Keywords that signal the user is asking about notes specifically
const NOTE_KEYWORDS = /\bnotes?\b/i;

// Keywords that signal the user is asking about creation vs update
const UPDATE_KEYWORDS = /\b(?:updated?|modified|edited|changed)\b/i;

// Words to strip when extracting the "content" portion of a hybrid query
const TEMPORAL_STRIP =
  /\b(?:today|yesterday|this\s+week|last\s+week|(?:last|past)\s+\d+\s+days?|this\s+month|last\s+month)\b/gi;
const METADATA_STRIP =
  /\b(?:what|which|show|list|give|tell|me|my|have|has|i|did|do|the|from|in|during|about|notes?|created?|written|wrote|write|added|made|updated?|modified|edited|summarize|summarise|summary|of)\b/gi;

function extractContentQuery(query: string): string | undefined {
  let cleaned = query
    .replace(TEMPORAL_STRIP, '')
    .replace(METADATA_STRIP, '')
    .replace(/[?.,!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If there's meaningful content left (more than 2 characters), it's a hybrid query
  if (cleaned.length > 2) return cleaned;
  return undefined;
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

/**
 * Detect the intent of a user's chat query.
 *
 * @param query  The raw user message.
 * @param now    Current timestamp (default: `new Date()`). Pass explicitly for
 *               deterministic tests.
 */
export function detectQueryIntent(query: string, now: Date = new Date()): QueryIntent {
  // 1. Try to match a temporal pattern
  let temporalMatch: TemporalMatch | null = null;
  for (const matcher of TEMPORAL_MATCHERS) {
    temporalMatch = matcher(query, now);
    if (temporalMatch) break;
  }

  if (!temporalMatch) {
    return { type: 'semantic' };
  }

  // 2. Check for note-specific keywords
  const wantsNotes = NOTE_KEYWORDS.test(query);

  // 3. Determine date field
  const dateField: 'created_at' | 'updated_at' = UPDATE_KEYWORDS.test(query)
    ? 'updated_at'
    : 'created_at';

  // 4. Check for remaining content that needs semantic search
  const contentQuery = extractContentQuery(query);

  // 5. Classify intent
  const type: QueryIntentType = contentQuery ? 'hybrid' : 'metadata';

  return {
    type,
    temporal: temporalMatch.range,
    wantsNotes,
    contentQuery,
    dateField,
    dateLabel: temporalMatch.label,
  };
}
