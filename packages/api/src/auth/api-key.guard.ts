import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { ApiKeyService } from './api-key.service';
import { DATABASE } from '../database/database.providers';
import type { Database } from '../database/connection';
import { apiKeys } from '../database/schema';

export const API_KEY_REQUEST_PROPERTY = 'apiKey' as const;

/**
 * Guard that validates requests via API key authentication.
 *
 * Accepts the key from either:
 *   - Authorization: Bearer <key>
 *   - X-API-Key: <key>
 *
 * On success, attaches the ApiKeyRow to `request.apiKey` and updates lastUsedAt.
 * On failure, returns 401 with the standard error shape.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & Record<string, unknown>>();

    const key = this.extractKey(request);

    if (!key) {
      throw new UnauthorizedException({
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key: <key>',
        },
      });
    }

    const apiKeyRow = await this.apiKeyService.validateKey(key, this.db);

    if (!apiKeyRow) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid or has expired',
        },
      });
    }

    // Attach the API key record to the request for downstream use
    request[API_KEY_REQUEST_PROPERTY] = apiKeyRow;

    // Update lastUsedAt asynchronously — do not await so it never slows the request
    this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRow.id))
      .catch((err: unknown) => {
        this.logger.warn(`Failed to update lastUsedAt for key ${apiKeyRow.id}: ${String(err)}`);
      });

    return true;
  }

  private extractKey(request: FastifyRequest): string | null {
    // Check Authorization: Bearer <key>
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const key = authHeader.slice(7).trim();
      if (key.length > 0) return key;
    }

    // Check X-API-Key: <key>
    const apiKeyHeader = request.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
      return apiKeyHeader.trim();
    }

    return null;
  }
}
