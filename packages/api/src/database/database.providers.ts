import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabase } from './connection';
import type { Database } from './connection';

export const DATABASE = 'DATABASE';

export const databaseProviders: Provider[] = [
  {
    provide: DATABASE,
    inject: [ConfigService],
    useFactory: (config: ConfigService): Database => {
      const url = config.getOrThrow<string>('DATABASE_URL');
      return createDatabase(url);
    },
  },
];
