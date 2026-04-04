import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_SKIP_LICENSE_KEY } from './decorators/skip-license.decorator';
import { LicenseStore } from './license.store';

/**
 * Global guard that blocks all requests with HTTP 402 (Payment Required)
 * when no valid license is present.
 *
 * Behaviour:
 * - When LICENSE_DISABLED env var is truthy, all requests pass through.
 * - Routes decorated with @SkipLicense() are always allowed (health, license endpoints).
 * - Otherwise, checks LicenseStore.isValid() and rejects with 402 if invalid.
 *
 * Registered as APP_GUARD in LicenseModule, which is imported before AuthModule
 * so this guard runs before the JWT auth guard.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(LicenseStore) private readonly licenseStore: LicenseStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow bypass for local development and CI
    const disabled = process.env['LICENSE_DISABLED'];
    if (disabled === 'true' || disabled === '1' || disabled === 'yes') {
      return true;
    }

    // Check if the route/controller is marked @SkipLicense()
    const skip = this.reflector.getAllAndOverride<boolean>(IS_SKIP_LICENSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    if (this.licenseStore.isValid()) {
      return true;
    }

    const info = this.licenseStore.getStatus();
    throw new HttpException(
      {
        error: {
          code: 'LICENSE_REQUIRED',
          message:
            info.status === 'expired'
              ? 'Your license has expired. Please re-activate to continue.'
              : 'A valid license is required to use this application.',
          status: info.status,
        },
      },
      402,
    );
  }
}
