import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, NotImplementedException } from '@nestjs/common';
import { ReindexSourceCommand } from './reindex-source.command';

export interface ReindexSourceResult {
  readonly message: string;
}

@CommandHandler(ReindexSourceCommand)
export class ReindexSourceHandler implements ICommandHandler<ReindexSourceCommand> {
  private readonly logger = new Logger(ReindexSourceHandler.name);

  async execute(command: ReindexSourceCommand): Promise<ReindexSourceResult> {
    this.logger.log(`Reindex requested for source ${command.id} — deferred to Phase 3`);

    // Phase 3 will store original file content during ingestion and use it
    // here to re-run the pipeline. Until then, the endpoint exists but
    // returns 501 so clients can detect the feature flag.
    throw new NotImplementedException(
      'Reindex requires stored source content (Phase 3)',
    );
  }
}
