/**
 * Retry helpers shared by the resilient LLM provider wrapper.
 *
 * The providers return `Result<T, string>` where the error string contains
 * HTTP status codes (e.g. "HTTP 429", "HTTP 503") and network error text.
 * We classify those strings to decide whether another attempt is worthwhile.
 */

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
  readonly jitter: boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 8_000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * Returns true when the given provider error message indicates a transient
 * failure that should be retried (5xx, 429, timeout, network error).
 *
 * Everything else (4xx auth errors, validation errors, empty content) is
 * treated as terminal — retrying would not help.
 */
export function isRetryableError(message: string): boolean {
  const lower = message.toLowerCase();

  // Retry on rate limits and transient upstream failures.
  if (/\bhttp\s*429\b/.test(lower)) return true;
  if (/\bhttp\s*5\d{2}\b/.test(lower)) return true;

  // Retry on fetch/AbortSignal timeouts and raw connection errors.
  if (lower.includes('timeout')) return true;
  if (lower.includes('timed out')) return true;
  if (lower.includes('network error')) return true;
  if (lower.includes('econnreset')) return true;
  if (lower.includes('econnrefused')) return true;
  if (lower.includes('etimedout')) return true;
  if (lower.includes('enotfound')) return true;
  if (lower.includes('socket hang up')) return true;

  // Ask Sage rate-limit sentinel (returned as HTTP 200 + message body).
  if (lower.includes('rate limit')) return true;

  return false;
}

/**
 * Computes the delay before the next attempt, using exponential backoff and
 * optional full-jitter (see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/).
 */
export function computeDelay(attempt: number, options: RetryOptions): number {
  const exponential = options.initialDelayMs * Math.pow(options.backoffFactor, attempt);
  const capped = Math.min(exponential, options.maxDelayMs);
  if (!options.jitter) return capped;
  return Math.floor(Math.random() * capped);
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
