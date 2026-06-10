import { describe, it, expect, vi } from 'vitest';
import { ProviderAvailabilityService } from './provider-availability.service';
import type { LlmProvider } from '@delve/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLlm(available = true): LlmProvider {
  return {
    query: vi.fn(),
    streamQuery: vi.fn(),
    getModels: vi.fn().mockResolvedValue(
      available
        ? { ok: true, value: ['llama3.2'] }
        : { ok: false, error: 'connection refused' },
    ),
  } as unknown as LlmProvider;
}

function makeUnavailableLlm(errorMessage = 'connection refused'): LlmProvider {
  return {
    query: vi.fn(),
    streamQuery: vi.fn(),
    getModels: vi.fn().mockResolvedValue({ ok: false, error: errorMessage }),
  } as unknown as LlmProvider;
}

function makeThrowingLlm(): LlmProvider {
  return {
    query: vi.fn(),
    streamQuery: vi.fn(),
    getModels: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  } as unknown as LlmProvider;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProviderAvailabilityService', () => {
  describe('isAvailable()', () => {
    it('returns true when the provider probe succeeds', async () => {
      const svc = new ProviderAvailabilityService(makeLlm(true));
      expect(await svc.isAvailable()).toBe(true);
    });

    it('returns false when getModels returns a failure result', async () => {
      const svc = new ProviderAvailabilityService(makeUnavailableLlm());
      expect(await svc.isAvailable()).toBe(false);
    });

    it('returns false when getModels throws', async () => {
      const svc = new ProviderAvailabilityService(makeThrowingLlm());
      expect(await svc.isAvailable()).toBe(false);
    });

    it('caches a successful probe so getModels is not called again within the TTL', async () => {
      const llm = makeLlm(true);
      const svc = new ProviderAvailabilityService(llm);

      await svc.isAvailable();
      await svc.isAvailable();
      await svc.isAvailable();

      expect(llm.getModels).toHaveBeenCalledTimes(1);
    });

    it('caches a failed probe so getModels is not called again within the TTL', async () => {
      const llm = makeUnavailableLlm();
      const svc = new ProviderAvailabilityService(llm);

      await svc.isAvailable();
      await svc.isAvailable();
      await svc.isAvailable();

      expect(llm.getModels).toHaveBeenCalledTimes(1);
    });

    it('re-probes after the cache is reset', async () => {
      const llm = makeLlm(true);
      const svc = new ProviderAvailabilityService(llm);

      await svc.isAvailable();
      expect(llm.getModels).toHaveBeenCalledTimes(1);

      svc.resetForTest();

      await svc.isAvailable();
      expect(llm.getModels).toHaveBeenCalledTimes(2);
    });

    it('resets consecutive failure counter after a successful probe', async () => {
      const llm = makeUnavailableLlm();
      const svc = new ProviderAvailabilityService(llm);

      // Record two failures
      await svc.isAvailable();
      svc.resetForTest();
      await svc.isAvailable();
      svc.resetForTest();

      // Now make it succeed
      (llm.getModels as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        value: ['llama3.2'],
      });
      const result = await svc.isAvailable();

      expect(result).toBe(true);

      // Failure counter should be reset — a subsequent failure should NOT
      // immediately jump to the backoff threshold warning (we'd need 3 more)
      svc.resetForTest();
      (llm.getModels as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        error: 'down again',
      });
      await svc.isAvailable(); // failure #1
      expect(llm.getModels).toHaveBeenCalledTimes(4); // proof it re-probed
    });
  });

  describe('backoff behaviour', () => {
    it('returns false on 5 consecutive failures without throwing', async () => {
      const llm = makeUnavailableLlm();
      const svc = new ProviderAvailabilityService(llm);

      // Each call resets TTL so we can probe multiple times
      for (let i = 0; i < 5; i++) {
        svc.resetForTest();
        const result = await svc.isAvailable();
        expect(result).toBe(false);
      }
    });

    it('does not throw when getModels rejects on repeated calls', async () => {
      const llm = makeThrowingLlm();
      const svc = new ProviderAvailabilityService(llm);

      await expect(async () => {
        for (let i = 0; i < 5; i++) {
          svc.resetForTest();
          await svc.isAvailable();
        }
      }).not.toThrow();
    });
  });
});
