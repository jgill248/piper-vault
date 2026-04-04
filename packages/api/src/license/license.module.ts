import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { LicenseStore } from './license.store';
import { LicenseGuard } from './license.guard';
import { LicenseController } from './license.controller';
import { ActivateLicenseHandler } from './commands/activate-license.handler';
import { GetLicenseStatusHandler } from './queries/get-license-status.handler';

const CommandHandlers = [ActivateLicenseHandler];
const QueryHandlers = [GetLicenseStatusHandler];

/**
 * Global license module. Registers LicenseGuard as an APP_GUARD.
 *
 * Must be imported before AuthModule in app.module.ts so the license guard
 * runs before the JWT auth guard (NestJS processes APP_GUARD providers
 * in module registration order).
 */
@Global()
@Module({
  imports: [CqrsModule],
  controllers: [LicenseController],
  providers: [
    LicenseStore,
    LicenseGuard,
    { provide: APP_GUARD, useClass: LicenseGuard },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [LicenseStore, LicenseGuard],
})
export class LicenseModule {}
