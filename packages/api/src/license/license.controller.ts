import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { LicenseInfo, ActivateLicenseResponse } from '@delve/shared';
import { Public } from '../auth/decorators/public.decorator';
import { SkipLicense } from './decorators/skip-license.decorator';
import { GetLicenseStatusQuery } from './queries/get-license-status.query';
import { ActivateLicenseCommand } from './commands/activate-license.command';
import { ActivateLicenseDtoSchema } from './dto/activate-license.dto';

/**
 * License endpoints. Both are exempt from the license guard (@SkipLicense)
 * and the JWT auth guard (@Public) so they are always accessible.
 */
@SkipLicense()
@Public()
@Controller('license')
export class LicenseController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('status')
  async getStatus(): Promise<LicenseInfo> {
    return this.queryBus.execute(new GetLicenseStatusQuery());
  }

  @Post('activate')
  async activate(
    @Body() body: unknown,
  ): Promise<ActivateLicenseResponse> {
    const result = ActivateLicenseDtoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message ?? 'Invalid input',
        },
      });
    }

    return this.commandBus.execute(
      new ActivateLicenseCommand(result.data.licenseKey),
    );
  }
}
