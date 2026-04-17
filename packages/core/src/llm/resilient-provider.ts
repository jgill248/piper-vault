import { err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { LlmProvider, LlmQuery, LlmResponse, LlmStreamChunk } from './provider.js';
import {
  DEFAULT_RETRY_OPTIONS,
  computeDelay,
  isRetryableError,
  sleep,
  type RetryOptions,
} from './retry.js';

export interface ResilientProviderEntry {
  readonly name: string;
  readonly provider: LlmProvider;
}

export interface ResilientProviderOptions {
  readonly retry?: Partial<RetryOptions>;
  /**
   * Optional callback invoked whenever an attempt fails. Useful for wiring
   * structured logging without coupling this class to a specific logger.
   */
  readonly onAttemptError?: (event: ResilientAttemptError) => void;
}

export interface ResilientAttemptError {
  readonly providerName: string;
  readonly attempt: number;
  readonly error: string;
  readonly willRetry: boolean;
  readonly willFallback: boolean;
}

/**
 * ResilientLlmProvider wraps one or more providers with exponential-backoff
 * retries on the primary and ordered fallback to subsequent providers when
 * the primary exhausts retries or emits a terminal error.
 *
 * The first entry is the primary. Remaining entries are tried in order after
 * the preceding provider gives up.
 *
 * Streaming: retries and fallback are only attempted before any delta is
 * yielded to the caller. Once the stream has produced user-visible output,
 * switching providers mid-stream would corrupt the response.
 */
export class ResilientLlmProvider implements LlmProvider {
  private readonly entries: readonly ResilientProviderEntry[];
  private readonly retryOptions: RetryOptions;
  private readonly onAttemptError?: (event: ResilientAttemptError) => void;

  constructor(entries: readonly ResilientProviderEntry[], options: ResilientProviderOptions = {}) {
    if (entries.length === 0) {
      throw new Error('ResilientLlmProvider requires at least one provider entry');
    }
    this.entries = entries;
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options.retry };
    this.onAttemptError = options.onAttemptError;
  }

  async query(input: LlmQuery): Promise<Result<LlmResponse, string>> {
    const errors: string[] = [];

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i]!;
      const isLast = i === this.entries.length - 1;
      const result = await this.queryWithRetry(entry, input, isLast);
      if (result.ok) return result;
      errors.push(`${entry.name}: ${result.error}`);
    }

    return err(`All LLM providers failed — ${errors.join('; ')}`);
  }

  private async queryWithRetry(
    entry: ResilientProviderEntry,
    input: LlmQuery,
    isLastEntry: boolean,
  ): Promise<Result<LlmResponse, string>> {
    let lastError = 'unknown error';

    for (let attempt = 0; attempt < this.retryOptions.maxAttempts; attempt += 1) {
      const result = await entry.provider.query(input);
      if (result.ok) return result;

      lastError = result.error;
      const retryable = isRetryableError(result.error);
      const attemptsRemain = attempt + 1 < this.retryOptions.maxAttempts;
      const willRetry = retryable && attemptsRemain;
      const willFallback = !willRetry && !isLastEntry;

      this.onAttemptError?.({
        providerName: entry.name,
        attempt: attempt + 1,
        error: result.error,
        willRetry,
        willFallback,
      });

      if (!willRetry) break;
      await sleep(computeDelay(attempt, this.retryOptions));
    }

    return err(lastError);
  }

  async getModels(): Promise<Result<readonly string[], string>> {
    // Models come from the primary provider only. Falling back would show a
    // confusing model list the primary cannot serve.
    return this.entries[0]!.provider.getModels();
  }

  async *streamQuery(input: LlmQuery): AsyncIterable<LlmStreamChunk> {
    const errors: string[] = [];

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i]!;
      const isLast = i === this.entries.length - 1;

      for (let attempt = 0; attempt < this.retryOptions.maxAttempts; attempt += 1) {
        const probe = await this.probeStream(entry, input);
        if (probe.kind === 'ok') {
          yield* probe.stream;
          return;
        }

        const retryable = isRetryableError(probe.error);
        const attemptsRemain = attempt + 1 < this.retryOptions.maxAttempts;
        const willRetry = retryable && attemptsRemain;
        const willFallback = !willRetry && !isLast;

        this.onAttemptError?.({
          providerName: entry.name,
          attempt: attempt + 1,
          error: probe.error,
          willRetry,
          willFallback,
        });

        if (!willRetry) {
          errors.push(`${entry.name}: ${probe.error}`);
          break;
        }
        await sleep(computeDelay(attempt, this.retryOptions));
      }
    }

    yield {
      delta: `[Error: All LLM providers failed — ${errors.join('; ')}]`,
      done: true,
    };
  }

  /**
   * Pulls the first chunk from the underlying stream. If it is an error
   * terminal chunk, the stream is discarded and the error string is returned
   * so the caller can decide to retry or fall back. Otherwise, a replay
   * iterator is returned that yields the first chunk followed by the rest.
   */
  private async probeStream(
    entry: ResilientProviderEntry,
    input: LlmQuery,
  ): Promise<
    | { readonly kind: 'ok'; readonly stream: AsyncIterable<LlmStreamChunk> }
    | { readonly kind: 'error'; readonly error: string }
  > {
    const iterator = entry.provider.streamQuery(input)[Symbol.asyncIterator]();
    let first: IteratorResult<LlmStreamChunk>;
    try {
      first = await iterator.next();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { kind: 'error', error: message };
    }

    if (first.done === true) {
      return { kind: 'error', error: 'stream ended with no data' };
    }

    const chunk = first.value;
    const looksLikeError =
      chunk.done && chunk.delta.startsWith('[Error:') && chunk.delta.endsWith(']');
    if (looksLikeError) {
      const message = chunk.delta.slice('[Error:'.length, -1).trim();
      return { kind: 'error', error: message };
    }

    async function* replay(): AsyncIterable<LlmStreamChunk> {
      yield chunk;
      while (true) {
        const next = await iterator.next();
        if (next.done === true) return;
        yield next.value;
      }
    }

    return { kind: 'ok', stream: replay() };
  }
}
