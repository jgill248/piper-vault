import { Module } from '@nestjs/common';
import { ConfigAppController } from './config.controller';

@Module({
  controllers: [ConfigAppController],
})
export class ConfigAppModule {}
