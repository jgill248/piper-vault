import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '../database/connection';

interface HealthResponse {
  readonly status: 'ok' | 'degraded';
  readonly timestamp: string;
  readonly db: 'ok' | 'error';
  readonly embedding: 'ok' | 'warn';
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject('DATABASE') private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let dbStatus: 'ok' | 'error' = 'ok';

    try {
      await this.db.execute(sql`SELECT 1`);
    } catch (err) {
      this.logger.warn(`Database health check failed: ${err}`);
      dbStatus = 'error';
    }

    // MockEmbedder is always available; real ONNX model check can be added later
    const embeddingStatus: 'ok' | 'warn' = 'warn';

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      db: dbStatus,
      embedding: embeddingStatus,
    };
  }
}
