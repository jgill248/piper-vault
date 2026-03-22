import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';

interface Reply {
  status(code: number): Reply;
  send(body: unknown): void;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<Reply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // If the handler already provided our structured { error: { code, message } } shape,
      // pass it through unchanged.
      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as Record<string, unknown>)['error'] === 'object'
      ) {
        void reply.status(status).send(body);
        return;
      }

      const message =
        typeof body === 'string'
          ? body
          : (body as Record<string, unknown>)['message'] ?? exception.message;

      void reply.status(status).send({
        error: {
          code: `HTTP_${status}`,
          message,
        },
      });
      return;
    }

    // Unhandled / unexpected errors — log full details, send sanitised response
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    void reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
}
