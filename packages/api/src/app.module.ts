import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CoreProvidersModule } from './core/core-providers.module';
import { SourcesModule } from './sources/sources.module';
import { ChatModule } from './chat/chat.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { ConfigAppModule } from './config/config.module';

@Module({
  imports: [
    // Load environment variables from .env; available throughout the app via
    // ConfigService. isGlobal means other modules need not import ConfigModule.
    ConfigModule.forRoot({ isGlobal: true }),

    // Infrastructure
    DatabaseModule,
    CoreProvidersModule,

    // Feature modules
    SourcesModule,
    ChatModule,
    SearchModule,
    HealthModule,
    ConfigAppModule,
  ],
})
export class AppModule {}
