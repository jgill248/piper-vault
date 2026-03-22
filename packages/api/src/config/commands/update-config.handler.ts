import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Logger, UnprocessableEntityException, Inject } from '@nestjs/common';
import { z } from 'zod';
import type { AppConfig } from '@delve/shared';
import { UpdateConfigCommand } from './update-config.command';
import { ConfigStore } from '../config.store';

const ConfigUpdatesSchema = z
  .object({
    llmModel: z.string().min(1).optional(),
    llmProvider: z.enum(['ask-sage', 'anthropic', 'openai', 'ollama']).optional(),
    embeddingModel: z.string().min(1).optional(),
    chunkSize: z.number().int().min(128).max(2048).optional(),
    chunkOverlap: z.number().int().min(0).optional(),
    topKResults: z.number().int().min(1).max(50).optional(),
    similarityThreshold: z.number().min(0).max(1).optional(),
    maxContextTokens: z.number().int().min(500).max(32000).optional(),
    maxConversationTurns: z.number().int().min(1).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    // chunkOverlap must be less than chunkSize — validate against the merged
    // values that the handler will compute, so we surface errors before writing.
    if (data.chunkOverlap !== undefined && data.chunkSize !== undefined) {
      if (data.chunkOverlap >= data.chunkSize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['chunkOverlap'],
          message: 'chunkOverlap must be less than chunkSize',
        });
      }
    }
  });

@Injectable()
@CommandHandler(UpdateConfigCommand)
export class UpdateConfigHandler implements ICommandHandler<UpdateConfigCommand> {
  private readonly logger = new Logger(UpdateConfigHandler.name);

  constructor(@Inject(ConfigStore) private readonly configStore: ConfigStore) {}

  async execute(command: UpdateConfigCommand): Promise<AppConfig> {
    const parsed = ConfigUpdatesSchema.safeParse(command.updates);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid config update',
          details: parsed.error.flatten(),
        },
      });
    }

    const updates = parsed.data;

    // Cross-field validation against the merged result so that supplying only
    // one of chunkSize / chunkOverlap is still correctly checked.
    const current = this.configStore.get();
    const merged = { ...current, ...updates };
    if (merged.chunkOverlap >= merged.chunkSize) {
      throw new UnprocessableEntityException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'chunkOverlap must be less than chunkSize',
          details: { chunkOverlap: merged.chunkOverlap, chunkSize: merged.chunkSize },
        },
      });
    }

    const updated = this.configStore.update(updates);
    this.logger.log(`Config updated: ${JSON.stringify(updates)}`);
    return updated;
  }
}
