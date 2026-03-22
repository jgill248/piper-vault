import { describe, it, expect } from 'vitest';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  const service = new ApiKeyService();

  describe('generateKey', () => {
    it('returns a key with the dlv_ prefix', () => {
      const { key } = service.generateKey();
      expect(key).toMatch(/^dlv_[0-9a-f]{64}$/);
    });

    it('returns a 68-character key', () => {
      const { key } = service.generateKey();
      // "dlv_" (4) + 64 hex chars = 68
      expect(key).toHaveLength(68);
    });

    it('returns an 8-character prefix', () => {
      const { prefix } = service.generateKey();
      expect(prefix).toHaveLength(8);
    });

    it('prefix matches the first 8 chars of the key', () => {
      const { key, prefix } = service.generateKey();
      expect(prefix).toBe(key.slice(0, 8));
    });

    it('returns a 64-character SHA-256 hex hash', () => {
      const { keyHash } = service.generateKey();
      expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique keys on each call', () => {
      const a = service.generateKey();
      const b = service.generateKey();
      expect(a.key).not.toBe(b.key);
      expect(a.keyHash).not.toBe(b.keyHash);
    });
  });

  describe('hashKey', () => {
    it('produces consistent hashes for the same input', () => {
      const key = 'dlv_test_key_value';
      expect(service.hashKey(key)).toBe(service.hashKey(key));
    });

    it('produces different hashes for different inputs', () => {
      expect(service.hashKey('key_a')).not.toBe(service.hashKey('key_b'));
    });

    it('returns a 64-character hex string', () => {
      const hash = service.hashKey('dlv_some_key');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('round-trips: generated key hash matches hashKey result', () => {
      const { key, keyHash } = service.generateKey();
      expect(service.hashKey(key)).toBe(keyHash);
    });
  });
});
