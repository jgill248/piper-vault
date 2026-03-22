import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthController } from './auth.controller';

/**
 * Global auth module that provides:
 * - ApiKeyService / ApiKeyGuard for webhook-style programmatic access
 * - AuthService / JwtAuthGuard for JWT-based user authentication
 *
 * The JwtAuthGuard is registered as a global APP_GUARD so it automatically
 * runs on every request. Routes that should be publicly accessible must be
 * decorated with @Public().
 *
 * When AUTH_ENABLED env var is falsy (the default), JwtAuthGuard passes all
 * requests through unconditionally — no behaviour change from a pre-auth build.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    AuthService,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [ApiKeyService, ApiKeyGuard, AuthService, JwtAuthGuard],
})
export class AuthModule {}
