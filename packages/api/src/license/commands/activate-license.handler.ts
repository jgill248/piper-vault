import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger } from '@nestjs/common';
import type { ActivateLicenseResponse } from '@delve/shared';
import { ActivateLicenseCommand } from './activate-license.command';
import { LicenseStore } from '../license.store';

const DEFAULT_LICENSE_SERVER_URL =
  'https://license.delve.app/api/v1/activate';

@CommandHandler(ActivateLicenseCommand)
export class ActivateLicenseHandler
  implements ICommandHandler<ActivateLicenseCommand, ActivateLicenseResponse>
{
  private readonly logger = new Logger(ActivateLicenseHandler.name);
  private readonly licenseServerUrl: string;

  constructor(
    @Inject(LicenseStore) private readonly licenseStore: LicenseStore,
  ) {
    this.licenseServerUrl =
      process.env['LICENSE_SERVER_URL'] ?? DEFAULT_LICENSE_SERVER_URL;
  }

  async execute(
    command: ActivateLicenseCommand,
  ): Promise<ActivateLicenseResponse> {
    let token: string;

    try {
      this.logger.log(`Activating license against ${this.licenseServerUrl}`);

      const response = await fetch(this.licenseServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: command.licenseKey }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ error: { message: response.statusText } }));
        const message =
          (body as { error?: { message?: string } }).error?.message ??
          'License server rejected the key';
        throw new BadRequestException({
          error: { code: 'LICENSE_ACTIVATION_FAILED', message },
        });
      }

      const body = (await response.json()) as { token?: string };
      if (!body.token) {
        throw new BadRequestException({
          error: {
            code: 'LICENSE_ACTIVATION_FAILED',
            message: 'License server returned an invalid response',
          },
        });
      }

      token = body.token;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      this.logger.error(`License activation failed: ${err}`);
      throw new BadRequestException({
        error: {
          code: 'LICENSE_ACTIVATION_FAILED',
          message:
            'Unable to reach the license server. Check your network connection and try again.',
        },
      });
    }

    let info;
    try {
      info = this.licenseStore.activate(token);
    } catch {
      throw new BadRequestException({
        error: {
          code: 'LICENSE_ACTIVATION_FAILED',
          message: 'License token signature verification failed',
        },
      });
    }

    this.logger.log(`License activated: plan=${info.plan}, expires=${info.expiresAt}`);

    return {
      status: 'activated',
      plan: info.plan!,
      expiresAt: info.expiresAt!,
    };
  }
}
