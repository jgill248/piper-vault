import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { LicenseModule } from './license/license.module';
import { NotesModule } from './notes/notes.module';
import { PresetsModule } from './presets/presets.module';

@Module({
  imports: [
    // Load environment variables from .env; available throughout the app via
    // ConfigService. isGlobal means other modules need not import ConfigModule.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // Infrastructure
    DatabaseModule,

    // License (global — must come before AuthModule so license guard runs first)
    LicenseModule,

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
  ],
})
export class AppModule {}
