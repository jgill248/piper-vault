import { Injectable, Logger, Inject } from '@nestjs/common';
import type { LlmProvider } from '@delve/core';

/** TTL (ms) for a successful availability probe. */
const AVAILABLE_TTL_MS = 30_000;
/** TTL (ms) for a failed availability probe (shorter so we re-check sooner). */
const UNAVAILABLE_TTL_MS = 30_000;
/** Number of consecutive failures before entering backoff mode. */
const BACKOFF_THRESHOLD = 3;

interface CachedProbe {
  readonly available: boolean;
  readonly expiresAt: number;
}

/**
 * Caches the result of a lightweight LLM provider availability probe so that
 * every wiki generation attempt doesn't hammer a down provider with heavy
 * generation requests.
 *
 * Tracks consecutive failures: after BACKOFF_THRESHOLD consecutive provider
 * failures the service suppresses further attempts until the TTL window expires,
 * and logs ONE concise warning per failure window rather than a stack trace per
 * upload.
 */
@Injectable()
export class ProviderAvailabilityService {
  private readonly logger = new Logger(ProviderAvailabilityService.name);

  private cached: CachedProbe | null = null;
  private consecutiveFailures = 0;
  /** True when we have already logged a warning for the current failure window. */
  private warnedThisWindow = false;

  constructor(@Inject('LLM_PROVIDER') private readonly llm: LlmProvider) {}

  /**
   * Returns true if the LLM provider is reachable, false otherwise.
   *
   * The result is cached for AVAILABLE_TTL_MS / UNAVAILABLE_TTL_MS to reduce
   * probing overhead. When in backoff mode (consecutiveFailures >= threshold
   * and the TTL has not yet expired) the cached result is returned immediately
   * with a single consolidated warning rather than a per-call log line.
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();

    // Return cached result if still fresh
    if (this.cached !== null && now < this.cached.expiresAt) {
      if (!this.cached.available && !this.warnedThisWindow) {
        this.logger.warn(
          'LLM provider is unreachable; wiki generation skipped for this failure window. ' +
            'Retrying after TTL expires.',
        );
        this.warnedThisWindow = true;
      }
      return this.cached.available;
    }

    // Probe: a lightweight getModels() call is less expensive than a full LLM
    // query and sufficient to detect whether the provider daemon is running.
    try {
      const result = await this.llm.getModels();
      if (result.ok) {
        this.consecutiveFailures = 0;
        this.warnedThisWindow = false;
        this.cached = { available: true, expiresAt: now + AVAILABLE_TTL_MS };
        return true;
      } else {
        return this.handleProbeFailure(now, result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.handleProbeFailure(now, message);
    }
  }

  /**
   * Records a failed probe, updates consecutive-failure counter, and returns
   * false. Logs a single consolidated warning when the backoff threshold is
   * first crossed; suppresses further log lines within the same TTL window.
   */
  private handleProbeFailure(now: number, reason: string): boolean {
    this.consecutiveFailures++;
    this.cached = { available: false, expiresAt: now + UNAVAILABLE_TTL_MS };

    if (this.consecutiveFailures >= BACKOFF_THRESHOLD && !this.warnedThisWindow) {
      this.logger.warn(
        `LLM provider unreachable after ${this.consecutiveFailures} consecutive attempts ` +
          `(${reason}); wiki generation will be skipped for the next ${UNAVAILABLE_TTL_MS / 1000}s. ` +
          'Check provider settings or restart the LLM service.',
      );
      this.warnedThisWindow = true;
    } else if (this.consecutiveFailures < BACKOFF_THRESHOLD) {
      // Log individual failures below the threshold so operators can see them
      this.logger.warn(
        `LLM provider probe failed (attempt ${this.consecutiveFailures}/${BACKOFF_THRESHOLD}): ${reason}`,
      );
      // Reset warnedThisWindow so the backoff warning fires fresh next window
      this.warnedThisWindow = false;
    }

    return false;
  }

  /**
   * Resets state — exposed for testing only.
   */
  resetForTest(): void {
    this.cached = null;
    this.consecutiveFailures = 0;
    this.warnedThisWindow = false;
  }
}
