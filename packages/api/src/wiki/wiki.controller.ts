import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PromoteToWikiCommand } from './commands/promote-to-wiki.command';
import { RunWikiLintCommand } from './commands/run-wiki-lint.command';
import { InitializeWikiCommand } from './commands/initialize-wiki.command';
import { RegenerateWikiPageCommand } from './commands/regenerate-wiki-page.command';
import { GetWikiLogQuery } from './queries/get-wiki-log.query';
import { GetWikiIndexQuery } from './queries/get-wiki-index.query';
import { toWikiLogResponse } from './dto/wiki-log-response.dto';
import { DEFAULT_COLLECTION_ID } from '@delve/shared';

@Controller('wiki')
export class WikiController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /api/v1/wiki/promote — Promote a chat conversation to a wiki page.
   */
  @Post('promote')
  @HttpCode(HttpStatus.CREATED)
  async promote(
    @Body() body: { conversationId: string; messageId?: string; collectionId?: string },
  ) {
    const result = await this.commandBus.execute(
      new PromoteToWikiCommand(
        body.conversationId,
        body.messageId,
        body.collectionId ?? DEFAULT_COLLECTION_ID,
      ),
    );
    return result;
  }

  /**
   * POST /api/v1/wiki/initialize — Generate wiki pages from all existing unprocessed sources.
   */
  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initialize(@Body() body: { collectionId?: string }) {
    const result = await this.commandBus.execute(
      new InitializeWikiCommand(body.collectionId),
    );
    return result;
  }

  /**
   * POST /api/v1/wiki/lint — Run a wiki lint pass.
   */
  @Post('lint')
  @HttpCode(HttpStatus.OK)
  async lint(@Body() body: { collectionId?: string }) {
    const result = await this.commandBus.execute(
      new RunWikiLintCommand(body.collectionId),
    );
    return result;
  }

  /**
   * POST /api/v1/wiki/regenerate — Regenerate a wiki page from its contributing sources.
   */
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerate(@Body() body: { pageId: string; preview?: boolean }) {
    const result = await this.commandBus.execute(
      new RegenerateWikiPageCommand(body.pageId, body.preview ?? false),
    );
    return result;
  }

  /**
   * GET /api/v1/wiki/log — Get paginated wiki activity log.
   */
  @Get('log')
  async getLog(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('operation') operation?: string,
    @Query('collectionId') collectionId?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const result = await this.queryBus.execute(
      new GetWikiLogQuery(
        isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 200),
        isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0),
        operation,
        collectionId,
      ),
    );
    return {
      items: result.items.map(toWikiLogResponse),
      total: result.total,
    };
  }

  /**
   * GET /api/v1/wiki/index — Get structured wiki index/catalog.
   */
  @Get('index')
  async getIndex(@Query('collectionId') collectionId?: string) {
    return this.queryBus.execute(new GetWikiIndexQuery(collectionId));
  }
}
