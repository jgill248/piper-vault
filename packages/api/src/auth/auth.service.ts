import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { Database } from '../database/connection';
import { users } from '../database/schema';
import type { UserRow } from '../database/schema';
import { DATABASE } from '../database/database.providers';
import { SecretsStore } from '../config/secrets.store';
import type { LoginInput, RegisterInput } from '@delve/shared';

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '7d';
const JWT_SECRET_KEY = 'auth.jwtSecret';

/**
 * Service that handles user registration, login, and token validation.
 *
 * JWT secret resolution order:
 * 1. SecretsStore (persisted, encrypted)
 * 2. JWT_SECRET env var (migrated to SecretsStore on first read)
 * 3. Auto-generated secure random secret (persisted to SecretsStore)
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(SecretsStore) private readonly secretsStore: SecretsStore,
  ) {
    this.jwtSecret = this.resolveJwtSecret();
  }

  private resolveJwtSecret(): string {
    // 1. Check SecretsStore first (persisted from a previous boot)
    const stored = this.secretsStore.getSecret(JWT_SECRET_KEY);
    if (stored) return stored;

    // 2. Check env var — migrate to SecretsStore if it's a real secret
    const envSecret = process.env['JWT_SECRET'];
    if (envSecret && envSecret !== 'change-me-in-production') {
      this.secretsStore.setSecret(JWT_SECRET_KEY, envSecret);
      this.logger.log('Migrated JWT_SECRET from env to SecretsStore');
      return envSecret;
    }

    // 3. Auto-generate a secure secret and persist it
    const generated = randomBytes(32).toString('hex');
    this.secretsStore.setSecret(JWT_SECRET_KEY, generated);
    this.logger.log('Auto-generated JWT secret and persisted to SecretsStore');
    return generated;
  }

  async register(
    input: RegisterInput,
  ): Promise<{ user: UserRow; token: string }> {
    const passwordHash = await this.hashPassword(input.password);

    const [inserted] = await this.db
      .insert(users)
      .values({
        username: input.username,
        email: input.email,
        passwordHash,
        role: 'user',
      })
      .returning();

    if (inserted === undefined) {
      throw new Error('Failed to create user');
    }

    const token = this.generateToken(inserted);
    return { user: inserted, token };
  }

  async login(
    input: LoginInput,
  ): Promise<{ user: UserRow; token: string } | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    const user = rows[0];
    if (user === undefined) return null;

    const valid = await this.verifyPassword(input.password, user.passwordHash);
    if (!valid) return null;

    const token = this.generateToken(user);
    return { user, token };
  }

  async validateToken(token: string): Promise<UserRow | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { sub?: string };
      if (!payload.sub) return null;
      return this.getUserById(payload.sub);
    } catch {
      return null;
    }
  }

  async getUserById(id: string): Promise<UserRow | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  private generateToken(user: UserRow): string {
    return jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      this.jwtSecret,
      { expiresIn: JWT_EXPIRY },
    );
  }

  private async hashPassword(password: string): Promise<string> {
    return bcryptjs.hash(password, SALT_ROUNDS);
  }

  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }
}
