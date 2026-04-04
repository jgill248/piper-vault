import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Embedder } from '@delve/core';
import type { Database } from '../database/connection';
import { Public } from '../auth/decorators/public.decorator';
import { SkipLicense } from '../license/decorators/skip-license.decorator';

interface HealthResponse {
  readonly status: 'ok' | 'degraded';
  readonly timestamp: string;
  readonly db: 'ok' | 'error';
  readonly embedding: 'ok' | 'warn';
}

@SkipLicense()
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject('DATABASE') private readonly db: Database,
    @Inject('EMBEDDER') private readonly embedder: Embedder,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let dbStatus: 'ok' | 'error' = 'ok';

    try {
      await this.db.execute(sql`SELECT 1`);
    } catch (err) {
      this.logger.warn(`Database health check failed: ${err}`);
      dbStatus = 'error';
    }

    // Check if the embedder is a real model (has isReady) or a mock
    const embeddingStatus: 'ok' | 'warn' =
      'isReady' in this.embedder && (this.embedder as { isReady: boolean }).isReady
        ? 'ok'
        : 'warn';

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      db: dbStatus,
      embedding: embeddingStatus,
    };
  }
}
