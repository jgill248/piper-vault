import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import type { LicenseInfo } from '@delve/shared';
import { GetLicenseStatusQuery } from './get-license-status.query';
import { LicenseStore } from '../license.store';

@QueryHandler(GetLicenseStatusQuery)
export class GetLicenseStatusHandler
  implements IQueryHandler<GetLicenseStatusQuery, LicenseInfo>
{
  constructor(
    @Inject(LicenseStore) private readonly licenseStore: LicenseStore,
  ) {}

  async execute(_query: GetLicenseStatusQuery): Promise<LicenseInfo> {
    return this.licenseStore.getStatus();
  }
}
