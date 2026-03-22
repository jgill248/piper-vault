import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { ApiKeyRow } from '../database/schema';
import { API_KEY_REQUEST_PROPERTY } from './api-key.guard';

/**
 * Parameter decorator that extracts the validated API key record from the request.
 * Only works on routes protected by ApiKeyGuard.
 *
 * Usage:
 *   async myEndpoint(@ReqApiKey() apiKey: ApiKeyRow) { ... }
 */
export const ReqApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyRow => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & Record<string, unknown>>();
    return request[API_KEY_REQUEST_PROPERTY] as ApiKeyRow;
  },
);
