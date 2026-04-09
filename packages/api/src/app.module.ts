import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { CoreProvidersModule } from './core/core-providers.module';
import { CollectionsModule } from './collections/collections.module';
import { SourcesModule } from './sources/sources.module';
import { ChatModule } from './chat/chat.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { ConfigAppModule } from './config/config.module';
import { PluginsModule } from './plugins/plugins.module';
import { WatchedFoldersModule } from './watched-folders/watched-folders.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuthModule } from './auth/auth.module';
import { NotesModule } from './notes/notes.module';
import { PresetsModule } from './presets/presets.module';
import { WikiModule } from './wiki/wiki.module';

@Module({
  imports: [
    // Load environment variables from .env; available throughout the app via
    // ConfigService. isGlobal means other modules need not import ConfigModule.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // Rate limiting — 30 requests per minute global default (CWE-770)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),

    // Task scheduling for wiki lint and maintenance
    ScheduleModule.forRoot(),

    // Infrastructure
    DatabaseModule,

    // Auth (global — must come before feature modules so APP_GUARD is in scope)
    AuthModule,

    // PluginsModule must come before CoreProvidersModule so that the
    // PLUGIN_REGISTRY token is available when ingestionPipelineProvider resolves.
    PluginsModule,
    CoreProvidersModule,

    // Feature modules
    CollectionsModule,
    SourcesModule,
    ChatModule,
    SearchModule,
    HealthModule,
    ConfigAppModule,
    WatchedFoldersModule,
    ApiKeysModule,
    WebhooksModule,
    NotesModule,
    PresetsModule,
    WikiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
