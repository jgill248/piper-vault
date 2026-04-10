import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import { InitializeWikiCommand } from './initialize-wiki.command';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';
import { sources, wikiLog } from '../../database/schema';
import { ConfigStore } from '../../config/config.store';

export interface InitializeWikiResult {
  readonly totalEligible: number;
  readonly sourcesProcessed: number;
  readonly sourcesSkipped: number;
  readonly errors: readonly string[];
  readonly summary: string;
}

@CommandHandler(InitializeWikiCommand)
export class InitializeWikiHandler implements ICommandHandler<InitializeWikiCommand> {
  private readonly logger = new Logger(InitializeWikiHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    @Inject(CommandBus) private readonly commandBus: CommandBus,
  ) {}

  async execute(command: InitializeWikiCommand): Promise<Result<InitializeWikiResult, string>> {
    const cfg = this.configStore.get();
    if (!cfg.wikiEnabled) {
      return { ok: false, error: 'Wiki is not enabled. Enable it in Settings first.' };
    }

    const collectionId = command.collectionId ?? DEFAULT_COLLECTION_ID;

    // Find sources already processed by wiki generation (via wikiLog 'ingest' entries)
    const existingLogs = await this.db
      .select({ sourceTriggerIds: wikiLog.sourceTriggerIds })
      .from(wikiLog)
      .where(eq(wikiLog.operation, 'ingest'));

    const alreadyProcessedIds = new Set(
      existingLogs
        .map((l) => l.sourceTriggerIds)
        .filter((id): id is string => id !== null && id !== undefined),
    );

    // Find all ready, non-generated sources in this collection
    // (includes user-created notes, excludes wiki-generated notes)
    const allSources = await this.db
      .select({ id: sources.id, filename: sources.filename })
      .from(sources)
      .where(
        and(
          eq(sources.collectionId, collectionId),
          eq(sources.status, 'ready'),
          eq(sources.isGenerated, false),
        ),
      );

    const eligibleSources = allSources.filter((s) => !alreadyProcessedIds.has(s.id));
    const skipped = allSources.length - eligibleSources.length;

    if (eligibleSources.length === 0) {
      const summary = skipped > 0
        ? `All ${skipped} source(s) have already been processed`
        : 'No sources found to initialize from';
      return { ok: true, value: { totalEligible: 0, sourcesProcessed: 0, sourcesSkipped: skipped, errors: [], summary } };
    }

    this.logger.log(
      `Wiki initialization: ${eligibleSources.length} source(s) to process, ${skipped} already processed`,
    );

    let sourcesProcessed = 0;
    const errors: string[] = [];

    for (const source of eligibleSources) {
      try {
        await this.commandBus.execute(
          new GenerateWikiPagesCommand(source.id, collectionId, true),
        );
        sourcesProcessed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${source.filename}: ${message}`);
        this.logger.warn(`Wiki init failed for "${source.filename}": ${message}`);
      }
    }

    const summary = `Wiki initialization complete: ${sourcesProcessed} source(s) processed, ${skipped} skipped, ${errors.length} error(s)`;

    // Log the initialization operation
    await this.db.insert(wikiLog).values({
      operation: 'initialize',
      summary,
      affectedSourceIds: [],
      metadata: {
        totalEligible: eligibleSources.length,
        sourcesProcessed,
        sourcesSkipped: skipped,
        errorCount: errors.length,
        errors: errors.slice(0, 50),
      },
    });

    this.logger.log(summary);

    return {
      ok: true,
      value: {
        totalEligible: eligibleSources.length,
        sourcesProcessed,
        sourcesSkipped: skipped,
        errors,
        summary,
      },
    };
  }
}
