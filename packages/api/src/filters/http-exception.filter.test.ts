import { describe, it, expect, vi } from 'vitest';
import {
  HttpException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

function makeHost(sendFn: ReturnType<typeof vi.fn>) {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: sendFn,
  };
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({}),
    }),
    reply,
  };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('returns structured error for HttpException', () => {
    const send = vi.fn();
    const { reply } = makeHost(send);
    const host = { switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({}) }) };

    filter.catch(new NotFoundException('Source not found'), host as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    // NestJS NotFoundException body is { error, message, statusCode } — our filter
    // wraps non-structured bodies into { error: { code, message } }
    expect(send).toHaveBeenCalledWith({
      error: { code: 'HTTP_404', message: 'Source not found' },
    });
  });

  it('passes through pre-structured error bodies', () => {
    const send = vi.fn();
    const { reply } = makeHost(send);
    const host = { switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({}) }) };

    const exception = new BadRequestException({
      error: { code: 'DIRECTORY_NOT_FOUND', message: 'Dir missing' },
    });
    filter.catch(exception, host as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({
      error: { code: 'DIRECTORY_NOT_FOUND', message: 'Dir missing' },
    });
  });

  it('sanitises unhandled errors to INTERNAL_ERROR', () => {
    const send = vi.fn();
    const { reply } = makeHost(send);
    const host = { switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({}) }) };

    filter.catch(new Error('pg: connection refused'), host as any);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  it('handles non-Error thrown values', () => {
    const send = vi.fn();
    const { reply } = makeHost(send);
    const host = { switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({}) }) };

    filter.catch('unexpected string throw', host as any);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
