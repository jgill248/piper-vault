import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { API_PREFIX } from '@delve/shared';
import { GlobalExceptionFilter } from './filters/http-exception.filter';
import { runMigrations } from './database/migrate';

async function bootstrap(): Promise<void> {
  // Run database migrations before starting the server
  const dbUrl = process.env['DATABASE_URL'];
  if (dbUrl) {
    await runMigrations(dbUrl);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      requestTimeout: 60_000, // 60s — allow time for LLM round-trips
    }),
  );

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new GlobalExceptionFilter());

  // When CORS_ORIGIN is not set (e.g. single-container production where nginx
  // serves both frontend and API from the same origin), disable cross-origin
  // requests entirely so same-origin requests work without a wildcard.
  // In dev, docker-compose.yml sets CORS_ORIGIN=http://localhost:5173.
  const corsOrigin = process.env['CORS_ORIGIN'];
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin,
      methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT', 'OPTIONS'],
      credentials: true,
    });
  }

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
