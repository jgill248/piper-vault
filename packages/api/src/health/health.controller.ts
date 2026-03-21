import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  readonly status: 'ok';
  readonly timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
