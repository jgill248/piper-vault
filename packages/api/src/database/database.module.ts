import { Module, Global } from '@nestjs/common';
import { databaseProviders } from './database.providers';

/**
 * Global module so the DATABASE token is available everywhere without
 * re-importing DatabaseModule in every feature module.
 */
@Global()
@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {}
