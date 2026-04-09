import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WikiController } from './wiki.controller';
import { GenerateWikiPagesHandler } from './commands/generate-wiki-pages.handler';
import { PromoteToWikiHandler } from './commands/promote-to-wiki.handler';
import { RunWikiLintHandler } from './commands/run-wiki-lint.handler';
import { GetWikiLogHandler } from './queries/get-wiki-log.handler';
import { GetWikiIndexHandler } from './queries/get-wiki-index.handler';
import { SourceIngestedListener } from './events/source-ingested.listener';
import { WikiSchedulerService } from './services/wiki-scheduler.service';

const CommandHandlers = [GenerateWikiPagesHandler, PromoteToWikiHandler, RunWikiLintHandler];
const QueryHandlers = [GetWikiLogHandler, GetWikiIndexHandler];
const EventHandlers = [SourceIngestedListener];

@Module({
  imports: [CqrsModule],
  controllers: [WikiController],
  providers: [...CommandHandlers, ...QueryHandlers, ...EventHandlers, WikiSchedulerService],
})
export class WikiModule {}
