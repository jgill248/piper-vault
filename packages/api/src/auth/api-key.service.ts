import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../database/connection';
import { apiKeys } from '../database/schema';
import type { ApiKeyRow } from '../database/schema';

/**
 * Service responsible for generating, hashing, and validating API keys.
 *
 * Security model:
 * - Full keys are NEVER stored. Only the SHA-256 hex hash is persisted.
 * - The prefix (first 8 chars) is stored for display purposes only.
 * - Key format: "dlv_" + 64 hex chars (32 random bytes) = 68 chars total.
 */
@Injectable()
export class ApiKeyService {
  /**
   * Generates a new API key.
   * Returns the plaintext key (shown once), its SHA-256 hash (stored), and the prefix (displayed).
   */
  generateKey(): { key: string; keyHash: string; prefix: string } {
    const randomPart = randomBytes(32).toString('hex');
    const key = `dlv_${randomPart}`;
    const keyHash = this.hashKey(key);
    const prefix = key.slice(0, 8); // "dlv_" + 4 hex chars
    return { key, keyHash, prefix };
  }

  /**
   * Computes the SHA-256 hex digest of a raw API key string.
   */
  hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Looks up an API key by its hash in the database.
   * Returns the full ApiKeyRow if found and not expired, or null otherwise.
   */
  async validateKey(key: string, db: Database): Promise<ApiKeyRow | null> {
    const hash = this.hashKey(key);

    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    const row = rows[0];
    if (row === undefined) return null;

    // Check expiry
    if (row.expiresAt !== null && row.expiresAt < new Date()) {
      return null;
    }

    return row;
  }
}
