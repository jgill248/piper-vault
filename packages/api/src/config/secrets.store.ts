import { Injectable, Logger } from '@nestjs/common';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, hostname, userInfo } from 'node:os';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
} from 'node:crypto';

const SECRETS_DIR = join(homedir(), '.delve');
const SECRETS_PATH = join(SECRETS_DIR, 'secrets.json');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;

/** Shape of a single encrypted entry on disk. */
interface EncryptedEntry {
  readonly iv: string;
  readonly tag: string;
  readonly data: string;
}

/** Shape of the secrets.json file. */
interface SecretsFile {
  [key: string]: EncryptedEntry;
}

/**
 * SecretsStore manages encrypted credentials at `~/.delve/secrets.json`.
 *
 * Encryption: AES-256-GCM with a key derived from a stable machine fingerprint
 * (hostname + username) via PBKDF2. This is not vault-grade but prevents
 * plaintext credential leakage in config files.
 *
 * If decryption fails (e.g. machine fingerprint changed), individual secrets
 * gracefully return `undefined` rather than crashing.
 */
@Injectable()
export class SecretsStore {
  private readonly logger = new Logger(SecretsStore.name);
  private readonly encryptionKey: Buffer;
  private secrets: SecretsFile;

  /** Incremented on every write; used by LlmProviderProxy for cache invalidation. */
  private _generation = 0;

  constructor() {
    this.encryptionKey = this.deriveKey();
    this.secrets = this.loadFromDisk();
  }

  get generation(): number {
    return this._generation;
  }

  getSecret(key: string): string | undefined {
    const entry = this.secrets[key];
    if (!entry) return undefined;
    return this.decrypt(entry);
  }

  setSecret(key: string, value: string): void {
    this.secrets[key] = this.encrypt(value);
    this._generation++;
    this.saveToDisk();
  }

  deleteSecret(key: string): void {
    if (this.secrets[key] === undefined) return;
    const { [key]: _, ...rest } = this.secrets;
    this.secrets = rest;
    this._generation++;
    this.saveToDisk();
  }

  hasSecret(key: string): boolean {
    return this.secrets[key] !== undefined;
  }

  getMasked(key: string): string {
    const value = this.getSecret(key);
    if (!value) return '';
    if (value.length <= 4) return '••••';
    return '••••' + value.slice(-4);
  }

  private deriveKey(): Buffer {
    const salt = `delve-secrets-${hostname()}-${userInfo().username}`;
    return pbkdf2Sync(salt, 'delve-static-salt', PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  private encrypt(plaintext: string): EncryptedEntry {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    let data = cipher.update(plaintext, 'utf8', 'hex');
    data += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data,
    };
  }

  private decrypt(entry: EncryptedEntry): string | undefined {
    try {
      const iv = Buffer.from(entry.iv, 'hex');
      const tag = Buffer.from(entry.tag, 'hex');
      const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(tag);
      let plaintext = decipher.update(entry.data, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      return plaintext;
    } catch (e) {
      this.logger.warn(`Failed to decrypt secret entry — ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  }

  private loadFromDisk(): SecretsFile {
    try {
      if (existsSync(SECRETS_PATH)) {
        const raw = readFileSync(SECRETS_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as SecretsFile;
        this.logger.log(`Loaded secrets from ${SECRETS_PATH}`);
        return parsed;
      }
    } catch (e) {
      this.logger.warn(`Failed to load secrets from disk: ${e instanceof Error ? e.message : String(e)}`);
    }
    return {};
  }

  private saveToDisk(): void {
    try {
      const dir = dirname(SECRETS_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(SECRETS_PATH, JSON.stringify(this.secrets, null, 2), 'utf-8');
      this.logger.log(`Secrets saved to ${SECRETS_PATH}`);
    } catch (e) {
      this.logger.warn(`Failed to persist secrets to disk: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
