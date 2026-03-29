import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmProviderName, LlmProviderStatus } from '@delve/shared';
import { LLM_PROVIDERS, DEFAULT_PROVIDER_URLS } from '@delve/shared';
import { GetProviderSettingsQuery } from './get-provider-settings.query';
import { ConfigStore } from '../config.store';
import { SecretsStore } from '../secrets.store';

const PROVIDER_SECRET_KEYS: Record<string, string> = {
  'ask-sage': 'llm.ask-sage.token',
  'anthropic': 'llm.anthropic.apiKey',
  'openai': 'llm.openai.apiKey',
};

const PROVIDER_ENV_VARS: Record<string, string> = {
  'ask-sage': 'ASK_SAGE_TOKEN',
  'anthropic': 'ANTHROPIC_API_KEY',
  'openai': 'OPENAI_API_KEY',
};

@Injectable()
@QueryHandler(GetProviderSettingsQuery)
export class GetProviderSettingsHandler
  implements IQueryHandler<GetProviderSettingsQuery>
{
  constructor(
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(SecretsStore) private readonly secretsStore: SecretsStore,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async execute(_query: GetProviderSettingsQuery): Promise<LlmProviderStatus[]> {
    const config = this.configStore.get();

    return LLM_PROVIDERS.map((provider: LlmProviderName): LlmProviderStatus => {
      // Resolve effective base URL: user config > env var > default
      const userUrl = config.providerSettings[provider]?.baseUrl;
      let effectiveUrl = userUrl ?? DEFAULT_PROVIDER_URLS[provider];

      // For ollama, env var is also a source for base URL
      if (provider === 'ollama' && !userUrl) {
        const envUrl = this.configService.get<string>('OLLAMA_BASE_URL');
        if (envUrl) effectiveUrl = envUrl;
      }

      // Resolve credential status: SecretsStore > env var
      const secretKey = PROVIDER_SECRET_KEYS[provider];
      const envVar = PROVIDER_ENV_VARS[provider];

      if (!secretKey) {
        // Ollama: no credential needed
        return { provider, baseUrl: effectiveUrl, hasCredential: true, credentialHint: '' };
      }

      const hasSecretStored = this.secretsStore.hasSecret(secretKey);
      const envValue = envVar ? this.configService.get<string>(envVar) : undefined;
      const hasCredential = hasSecretStored || (envValue !== undefined && envValue !== '');

      let credentialHint = '';
      if (hasSecretStored) {
        credentialHint = this.secretsStore.getMasked(secretKey);
      } else if (envValue) {
        credentialHint = envValue.length > 4 ? '••••' + envValue.slice(-4) : '••••';
      }

      return { provider, baseUrl: effectiveUrl, hasCredential, credentialHint };
    });
  }
}
