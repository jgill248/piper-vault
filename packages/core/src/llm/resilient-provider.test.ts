import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '@delve/shared';
import type { Result } from '@delve/shared';
import type { LlmProvider, LlmQuery, LlmResponse, LlmStreamChunk } from './provider.js';
import { ResilientLlmProvider } from './resilient-provider.js';
import { isRetryableError } from './retry.js';

class FakeProvider implements LlmProvider {
  public queryCalls = 0;
  public streamCalls = 0;
  private readonly queryResponses: readonly Result<LlmResponse, string>[];
  private readonly streamResponses: readonly readonly LlmStreamChunk[][];

  constructor(
    queryResponses: readonly Result<LlmResponse, string>[],
    streamResponses: readonly readonly LlmStreamChunk[][] = [],
  ) {
    this.queryResponses = queryResponses;
    this.streamResponses = streamResponses;
  }

  async query(_input: LlmQuery): Promise<Result<LlmResponse, string>> {
    const response = this.queryResponses[this.queryCalls]
      ?? this.queryResponses[this.queryResponses.length - 1]
      ?? err('no response configured');
    this.queryCalls += 1;
    return response;
  }

  async getModels(): Promise<Result<readonly string[], string>> {
    return ok(['fake-model']);
  }

  async *streamQuery(_input: LlmQuery): AsyncIterable<LlmStreamChunk> {
    const chunks = this.streamResponses[this.streamCalls]
      ?? this.streamResponses[this.streamResponses.length - 1]
      ?? [];
    this.streamCalls += 1;
    for (const chunk of chunks) {
      yield chunk;
    }
  }
}

const FAST_RETRY = {
  maxAttempts: 3,
  initialDelayMs: 1,
  maxDelayMs: 4,
  backoffFactor: 2,
  jitter: false,
};

const INPUT: LlmQuery = { prompt: 'hello' };

describe('isRetryableError', () => {
  it('treats 429 and 5xx as retryable', () => {
    expect(isRetryableError('HTTP 429 rate limit')).toBe(true);
    expect(isRetryableError('HTTP 500 internal')).toBe(true);
    expect(isRetryableError('HTTP 503 unavailable')).toBe(true);
  });

  it('treats timeouts and connection errors as retryable', () => {
    expect(isRetryableError('network error during query')).toBe(true);
    expect(isRetryableError('operation timed out')).toBe(true);
    expect(isRetryableError('fetch failed: ECONNRESET')).toBe(true);
  });

  it('treats auth / validation errors as terminal', () => {
    expect(isRetryableError('HTTP 401 unauthorized')).toBe(false);
    expect(isRetryableError('HTTP 403 forbidden')).toBe(false);
    expect(isRetryableError('HTTP 400 bad request')).toBe(false);
    expect(isRetryableError('response contained no text content')).toBe(false);
  });
});

describe('ResilientLlmProvider.query', () => {
  it('returns the primary success without retries or fallback', async () => {
    const primary = new FakeProvider([ok({ content: 'ok', model: 'm' })]);
    const secondary = new FakeProvider([ok({ content: 'alt', model: 'm2' })]);

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY },
    );

    const result = await resilient.query(INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.content).toBe('ok');
    expect(primary.queryCalls).toBe(1);
    expect(secondary.queryCalls).toBe(0);
  });

  it('retries on 429 and eventually succeeds', async () => {
    const primary = new FakeProvider([
      err('HTTP 429 rate limit'),
      err('HTTP 429 rate limit'),
      ok({ content: 'recovered', model: 'm' }),
    ]);

    const resilient = new ResilientLlmProvider(
      [{ name: 'primary', provider: primary }],
      { retry: FAST_RETRY },
    );

    const result = await resilient.query(INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.content).toBe('recovered');
    expect(primary.queryCalls).toBe(3);
  });

  it('does not retry on non-retryable errors', async () => {
    const onAttempt = vi.fn();
    const primary = new FakeProvider([err('HTTP 401 unauthorized')]);
    const secondary = new FakeProvider([ok({ content: 'fallback', model: 'm2' })]);

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY, onAttemptError: onAttempt },
    );

    const result = await resilient.query(INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.content).toBe('fallback');
    expect(primary.queryCalls).toBe(1);
    expect(secondary.queryCalls).toBe(1);
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ providerName: 'primary', willRetry: false, willFallback: true }),
    );
  });

  it('falls back after exhausting retries on primary', async () => {
    const primary = new FakeProvider([
      err('HTTP 503 unavailable'),
      err('HTTP 503 unavailable'),
      err('HTTP 503 unavailable'),
    ]);
    const secondary = new FakeProvider([ok({ content: 'from-secondary', model: 'm2' })]);

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY },
    );

    const result = await resilient.query(INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.content).toBe('from-secondary');
    expect(primary.queryCalls).toBe(3);
    expect(secondary.queryCalls).toBe(1);
  });

  it('aggregates all provider failures when every provider fails', async () => {
    const primary = new FakeProvider([err('HTTP 500 boom')]);
    const secondary = new FakeProvider([err('HTTP 401 unauthorized')]);

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY },
    );

    const result = await resilient.query(INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('primary:');
      expect(result.error).toContain('secondary:');
    }
  });
});

describe('ResilientLlmProvider.streamQuery', () => {
  it('streams the primary when the first chunk is successful', async () => {
    const primary = new FakeProvider(
      [],
      [[
        { delta: 'hel', done: false },
        { delta: 'lo', done: false },
        { delta: '', done: true, model: 'm' },
      ]],
    );
    const secondary = new FakeProvider([], [[{ delta: 'alt', done: true }]]);

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY },
    );

    const chunks: LlmStreamChunk[] = [];
    for await (const chunk of resilient.streamQuery(INPUT)) chunks.push(chunk);

    expect(chunks.map((c) => c.delta).join('')).toBe('hello');
    expect(primary.streamCalls).toBe(1);
    expect(secondary.streamCalls).toBe(0);
  });

  it('falls back to secondary when primary emits a terminal error chunk', async () => {
    const primary = new FakeProvider(
      [],
      [[{ delta: '[Error: HTTP 503 unavailable]', done: true }]],
    );
    const secondary = new FakeProvider(
      [],
      [[
        { delta: 'alt', done: false },
        { delta: '', done: true, model: 'm2' },
      ]],
    );

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY },
    );

    const chunks: LlmStreamChunk[] = [];
    for await (const chunk of resilient.streamQuery(INPUT)) chunks.push(chunk);

    expect(chunks.map((c) => c.delta).join('')).toBe('alt');
    expect(primary.streamCalls).toBe(3); // retried 3 times before fallback
    expect(secondary.streamCalls).toBe(1);
  });

  it('does not retry a non-retryable stream error', async () => {
    const primary = new FakeProvider(
      [],
      [[{ delta: '[Error: HTTP 401 unauthorized]', done: true }]],
    );
    const secondary = new FakeProvider(
      [],
      [[
        { delta: 'alt', done: false },
        { delta: '', done: true },
      ]],
    );

    const resilient = new ResilientLlmProvider(
      [
        { name: 'primary', provider: primary },
        { name: 'secondary', provider: secondary },
      ],
      { retry: FAST_RETRY },
    );

    const chunks: LlmStreamChunk[] = [];
    for await (const chunk of resilient.streamQuery(INPUT)) chunks.push(chunk);

    expect(primary.streamCalls).toBe(1);
    expect(chunks.map((c) => c.delta).join('')).toBe('alt');
  });
});
