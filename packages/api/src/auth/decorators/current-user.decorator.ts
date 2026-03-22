import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserRow } from '../../database/schema';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 * Returns undefined when auth is disabled or the user is not authenticated.
 *
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentUser() user: UserRow) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserRow | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: UserRow }>();
    return request.user;
  },
);
