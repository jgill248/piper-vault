import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createPublicKey, createVerify, verify as cryptoVerify } from 'node:crypto';
import type { LicenseInfo, LicensePlan, LicenseStatus } from '@delve/shared';

const LICENSE_DIR = join(homedir(), '.delve');
const LICENSE_PATH = join(LICENSE_DIR, 'license.json');

/**
 * Ed25519 public key used to verify license JWTs.
 * The corresponding private key lives on the license server and is never shipped.
 *
 * Replace this with your production public key before distribution.
 */
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAOY03fI1LzuosE+tPnexhRjhGzsnEykI/HSnixweudbE=
-----END PUBLIC KEY-----`;

interface LicensePayload {
  readonly licenseKey: string;
  readonly plan: LicensePlan;
  readonly exp: number;
  readonly iat: number;
  readonly features?: Readonly<Record<string, boolean>>;
}

/**
 * File-based license store. Reads and writes `~/.delve/license.json`.
 *
 * The license token is a JWT signed with Ed25519. On disk it is stored as
 * `{ token: string }`. Verification uses Node's native crypto (not jsonwebtoken)
 * since jsonwebtoken@9 does not support EdDSA.
 */
@Injectable()
export class LicenseStore {
  private readonly logger = new Logger(LicenseStore.name);
  private cached: LicenseInfo;

  private readonly disabled: boolean;

  constructor() {
    const env = process.env['LICENSE_DISABLED'];
    this.disabled = env === 'true' || env === '1' || env === 'yes';
    this.cached = this.loadAndVerify();
  }

  getStatus(): LicenseInfo {
    if (this.disabled) {
      return { status: 'valid' };
    }
    return { ...this.cached };
  }

  isValid(): boolean {
    return this.disabled || this.cached.status === 'valid';
  }

  /**
   * Verify a signed license token, persist it to disk, and update the cache.
   * Throws if the signature is invalid.
   */
  activate(signedToken: string): LicenseInfo {
    const payload = this.verifyToken(signedToken);
    if (!payload) {
      throw new Error('License token has an invalid signature');
    }

    this.saveToDisk(signedToken);
    this.cached = this.payloadToInfo(payload);
    return this.getStatus();
  }

  /** Delete the license file (for testing/debugging). */
  clear(): void {
    try {
      if (existsSync(LICENSE_PATH)) {
        unlinkSync(LICENSE_PATH);
        this.logger.log('License file removed');
      }
    } catch (err) {
      this.logger.warn(`Failed to delete license file: ${err}`);
    }
    this.cached = { status: 'missing' };
  }

  private loadAndVerify(): LicenseInfo {
    try {
      if (!existsSync(LICENSE_PATH)) {
        this.logger.log('No license file found');
        return { status: 'missing' };
      }

      const raw = readFileSync(LICENSE_PATH, 'utf-8');
      const { token } = JSON.parse(raw) as { token?: string };
      if (!token) {
        this.logger.warn('License file exists but contains no token');
        return { status: 'invalid' };
      }

      const payload = this.verifyToken(token);
      if (!payload) {
        this.logger.warn('License token signature verification failed');
        return { status: 'invalid' };
      }

      return this.payloadToInfo(payload);
    } catch (err) {
      this.logger.warn(`Failed to load license: ${err}`);
      return { status: 'invalid' };
    }
  }

  /**
   * Verify an Ed25519-signed JWT manually using Node's crypto module.
   * Returns the decoded payload or null if verification fails.
   */
  private verifyToken(token: string): LicensePayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;

      // Verify the Ed25519 signature over `header.payload`
      const signedData = Buffer.from(`${headerB64}.${payloadB64}`);
      const signature = Buffer.from(signatureB64!, 'base64url');
      const publicKey = createPublicKey(LICENSE_PUBLIC_KEY_PEM);

      const isValid = cryptoVerify(null, signedData, publicKey, signature);
      if (!isValid) return null;

      // Decode payload
      const payloadJson = Buffer.from(payloadB64!, 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as LicensePayload;

      return payload;
    } catch {
      return null;
    }
  }

  private payloadToInfo(payload: LicensePayload): LicenseInfo {
    const now = Math.floor(Date.now() / 1000);
    const status: LicenseStatus = payload.exp > now ? 'valid' : 'expired';

    return {
      status,
      plan: payload.plan,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      ...(payload.features ? { features: payload.features } : {}),
    };
  }

  private saveToDisk(token: string): void {
    try {
      if (!existsSync(dirname(LICENSE_PATH))) {
        mkdirSync(dirname(LICENSE_PATH), { recursive: true });
      }
      writeFileSync(LICENSE_PATH, JSON.stringify({ token }, null, 2), 'utf-8');
      this.logger.log(`License saved to ${LICENSE_PATH}`);
    } catch (err) {
      this.logger.warn(`Failed to persist license to disk: ${err}`);
    }
  }
}
