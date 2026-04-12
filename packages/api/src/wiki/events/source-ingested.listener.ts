import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { SourceIngestedEvent } from '../../sources/events/source-ingested.event';
import { GenerateWikiPagesCommand } from '../commands/generate-wiki-pages.command';

@EventsHandler(SourceIngestedEvent)
export class SourceIngestedListener implements IEventHandler<SourceIngestedEvent> {
  private readonly logger = new Logger(SourceIngestedListener.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: SourceIngestedEvent): Promise<void> {
    if (event.isGenerated) {
      this.logger.debug(`Skipping wiki generation for generated source ${event.sourceId}`);
      return;
    }

    this.logger.debug(`Source ingested: ${event.sourceId} (${event.filename}), triggering wiki generation`);
    try {
      await this.commandBus.execute(
        new GenerateWikiPagesCommand(event.sourceId, event.collectionId),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Wiki generation failed for source ${event.sourceId}: ${message}`);
    }
  }
}
