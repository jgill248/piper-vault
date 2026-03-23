import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { API_PREFIX } from '@delve/shared';
import { GlobalExceptionFilter } from './filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Delve API running on http://localhost:${port}${API_PREFIX}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});

// Webpack HMR support
declare const module: { hot?: { accept: () => void; dispose: (cb: () => void) => void } };
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // app cleanup handled by NestJS
  });
}
