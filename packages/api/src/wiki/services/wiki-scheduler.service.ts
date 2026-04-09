import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { RunWikiLintCommand } from '../commands/run-wiki-lint.command';
import { ConfigStore } from '../../config/config.store';

@Injectable()
export class WikiSchedulerService {
  private readonly logger = new Logger(WikiSchedulerService.name);

  constructor(
    @Inject(ConfigStore) private readonly configStore: ConfigStore,
    private readonly commandBus: CommandBus,
  ) {}

  /**
   * Run wiki lint daily at 3 AM by default.
   * The actual schedule is configured via wikiLintSchedule in AppConfig,
   * but NestJS @Cron decorators require static expressions.
   * The handler checks if wiki is enabled before executing.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduledLint(): Promise<void> {
    const cfg = this.configStore.get();
    if (!cfg.wikiEnabled) {
      this.logger.debug('Wiki disabled, skipping scheduled lint');
      return;
    }

    this.logger.log('Starting scheduled wiki lint');
    try {
      const result = await this.commandBus.execute(new RunWikiLintCommand());
      if (result.ok) {
        this.logger.log(`Scheduled lint complete: ${result.value.summary}`);
      } else {
        this.logger.warn(`Scheduled lint failed: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scheduled lint error: ${message}`);
    }
  }
}
