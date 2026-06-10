import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import type { Result } from '@delve/shared';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';
import { InitializeWikiCommand } from './initialize-wiki.command';
import { GenerateWikiPagesCommand } from './generate-wiki-pages.command';
import type { WikiGenerationOutcome } from './generate-wiki-pages.handler';
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

  /** Collections with an initialization run currently in flight. */
  private readonly inFlight = new Set<string>();

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

    if (this.inFlight.has(collectionId)) {
      return { ok: false, error: 'Wiki initialization is already running for this collection. Progress appears in the Wiki Log.' };
    }

    // Find sources already processed by wiki generation (via wikiLog 'ingest'
    // entries for this collection). Failed runs are logged under 'error' and
    // therefore stay eligible for retry.
    const existingLogs = await this.db
      .select({ sourceTriggerIds: wikiLog.sourceTriggerIds })
      .from(wikiLog)
      .where(and(eq(wikiLog.operation, 'ingest'), eq(wikiLog.collectionId, collectionId)));

    const alreadyProcessedIds = new Set(
      existingLogs
        .map((l) => l.sourceTriggerIds)
        .filter((id): id is string => id !== null && id !== undefined),
    );

    // Find all ready, non-generated sources in this collection
    // (includes user-created notes, excludes wiki-generated notes)
    // Process sources chronologically so later sources can synthesize into
    // pages created by earlier sources during this initialization run.
    const allSources = await this.db
      .select({ id: sources.id, filename: sources.filename })
      .from(sources)
      .where(
        and(
          eq(sources.collectionId, collectionId),
          eq(sources.status, 'ready'),
          eq(sources.isGenerated, false),
        ),
      )
      .orderBy(asc(sources.createdAt));

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

    // Generation can take minutes per source (LLM calls), far beyond any HTTP
    // proxy timeout — run it in the background and return immediately. Each
    // source's outcome is recorded in wiki_log ('ingest' or 'error'), and a
    // final 'initialize' entry summarizes the run, so the UI can poll the log
    // for progress and completion.
    this.inFlight.add(collectionId);
    void this.processSources(eligibleSources, collectionId, skipped).finally(() => {
      this.inFlight.delete(collectionId);
    });

    const summary = `Wiki generation started for ${eligibleSources.length} source(s). Progress appears in the Wiki Log.`;
    return {
      ok: true,
      value: {
        totalEligible: eligibleSources.length,
        sourcesProcessed: 0,
        sourcesSkipped: skipped,
        errors: [],
        summary,
      },
    };
  }

  /** Sequentially generates wiki pages for each source and logs a final summary. */
  private async processSources(
    eligibleSources: readonly { id: string; filename: string }[],
    collectionId: string,
    skipped: number,
  ): Promise<void> {
    let sourcesProcessed = 0;
    const errors: string[] = [];

    for (const source of eligibleSources) {
      try {
        const outcome: WikiGenerationOutcome = await this.commandBus.execute(
          new GenerateWikiPagesCommand(source.id, collectionId, true),
        );
        if (outcome.status === 'failed') {
          errors.push(`${source.filename}: ${outcome.error ?? 'unknown error'}`);
        } else {
          sourcesProcessed++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${source.filename}: ${message}`);
        this.logger.warn(`Wiki init failed for "${source.filename}": ${message}`);
      }
    }

    const summary = errors.length > 0
      ? `Wiki initialization finished: ${sourcesProcessed} of ${eligibleSources.length} source(s) processed, ${errors.length} failed. First error: ${errors[0]}`
      : `Wiki initialization complete: ${sourcesProcessed} source(s) processed, ${skipped} skipped`;

    try {
      await this.db.insert(wikiLog).values({
        operation: 'initialize',
        summary,
        affectedSourceIds: [],
        collectionId,
        metadata: {
          totalEligible: eligibleSources.length,
          sourcesProcessed,
          sourcesSkipped: skipped,
          errorCount: errors.length,
          errors: errors.slice(0, 50),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to record wiki initialization summary: ${message}`);
    }

    this.logger.log(summary);
  }
}
