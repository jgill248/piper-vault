import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { UserRow } from '../database/schema';

/**
 * Global JWT authentication guard.
 *
 * Behaviour:
 * - When AUTH_ENABLED env var is falsy (the default), ALL requests pass through
 *   with no authentication required. This is the backward-compatible default.
 * - When AUTH_ENABLED is truthy:
 *   - Routes decorated with @Public() pass through without auth.
 *   - All other routes require a valid JWT in the Authorization: Bearer header.
 *   - On success, the authenticated UserRow is attached to request.user.
 *   - On failure, a 401 is returned.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly authEnabled: boolean;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {
    const raw = process.env['AUTH_ENABLED'];
    this.authEnabled =
      raw === 'true' || raw === '1' || raw === 'yes';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Auth is globally disabled — let all requests through
    if (!this.authEnabled) {
      return true;
    }

    // Check if the route/controller is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: UserRow }>();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        error: {
          code: 'MISSING_TOKEN',
          message:
            'Authentication required. Provide a JWT via Authorization: Bearer <token>',
        },
      });
    }

    const user = await this.authService.validateToken(token);
    if (!user) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_TOKEN',
          message: 'The provided token is invalid or has expired',
        },
      });
    }

    request.user = user;
    return true;
  }

  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.length > 0) return token;
    }
    return null;
  }
}
