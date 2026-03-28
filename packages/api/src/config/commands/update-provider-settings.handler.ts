import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Logger, UnprocessableEntityException, Inject } from '@nestjs/common';
import { z } from 'zod';
import type { LlmProviderStatus } from '@delve/shared';
import { DEFAULT_PROVIDER_URLS, LLM_PROVIDERS } from '@delve/shared';
import { UpdateProviderSettingsCommand } from './update-provider-settings.command';
import { ConfigStore } from '../config.store';
import { SecretsStore } from '../secrets.store';

const PROVIDER_SECRET_KEYS: Record<string, string> = {
  'ask-sage': 'llm.ask-sage.token',
  'anthropic': 'llm.anthropic.apiKey',
  'openai': 'llm.openai.apiKey',
};

const ProviderSettingsSchema = z.object({
  baseUrl: z.string().url().or(z.literal('')).optional(),
  apiKey: z.string().optional(),
});

@Injectable()
@CommandHandler(UpdateProviderSettingsCommand)
export class UpdateProviderSettingsHandler
  implements ICommandHandler<UpdateProviderSettingsCommand>
{
  private readonly logger = new Logger(UpdateProviderSettingsHandler.name);

  constructor(
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(SecretsStore) private readonly secretsStore: SecretsStore,
  ) {}

  async execute(command: UpdateProviderSettingsCommand): Promise<LlmProviderStatus> {
    const { provider, baseUrl, apiKey } = command;

    // Validate provider name
    if (!(LLM_PROVIDERS as readonly string[]).includes(provider)) {
      throw new UnprocessableEntityException({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid provider: ${provider}. Must be one of: ${LLM_PROVIDERS.join(', ')}`,
        },
      });
    }

    // Validate settings shape
    const parsed = ProviderSettingsSchema.safeParse({ baseUrl, apiKey });
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid provider settings',
          details: parsed.error.flatten(),
        },
      });
    }

    // Update base URL in config store
    if (baseUrl !== undefined) {
      const current = this.configStore.get();
      const updatedProviderSettings = {
        ...current.providerSettings,
        [provider]: {
          ...current.providerSettings[provider],
          baseUrl: baseUrl || undefined, // empty string clears the override
        },
      };
      this.configStore.update({ providerSettings: updatedProviderSettings });
      this.logger.log(`Updated base URL for provider ${provider}`);
    }

    // Update API key in secrets store
    if (apiKey !== undefined) {
      const secretKey = PROVIDER_SECRET_KEYS[provider];
      if (secretKey) {
        if (apiKey === '') {
          this.secretsStore.deleteSecret(secretKey);
          this.logger.log(`Cleared API key for provider ${provider}`);
        } else {
          this.secretsStore.setSecret(secretKey, apiKey);
          this.logger.log(`Updated API key for provider ${provider}`);
        }
      }
    }

    // Build and return the updated status
    const config = this.configStore.get();
    const effectiveUrl =
      config.providerSettings[provider]?.baseUrl ?? DEFAULT_PROVIDER_URLS[provider];
    const secretKey = PROVIDER_SECRET_KEYS[provider];
    const hasCredential = secretKey ? this.secretsStore.hasSecret(secretKey) : true;
    const credentialHint = secretKey ? this.secretsStore.getMasked(secretKey) : '';

    return { provider, baseUrl: effectiveUrl, hasCredential, credentialHint };
  }
}
