import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { Database } from '../database/connection';
import { users } from '../database/schema';
import type { UserRow } from '../database/schema';
import { DATABASE } from '../database/database.providers';
import type { LoginInput, RegisterInput } from '@delve/shared';

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

/**
 * Service that handles user registration, login, and token validation.
 *
 * JWT secret is read from JWT_SECRET env var. If not set in production a
 * warning is emitted, but the service still works using a fallback secret
 * suitable for development.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(@Inject(DATABASE) private readonly db: Database) {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      this.logger.warn(
        'JWT_SECRET env var is not set. Using insecure default secret. ' +
          'Set JWT_SECRET in production.',
      );
    }
    this.jwtSecret = secret ?? 'delve-dev-secret-change-me-in-production';
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
