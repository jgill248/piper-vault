import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { FastifyReply } from 'fastify';
import {
  VAULT_EXPORT_FORMAT_VERSION,
  validateVaultExportPayload,
  type VaultExportPayload,
} from '@delve/core';
import { ExportVaultQuery } from './queries/export-vault.query';
import { ImportVaultCommand, type ImportVaultResult } from './commands/import-vault.command';

const MAX_IMPORT_BYTES = 100 * 1024 * 1024; // 100 MB hard ceiling on a single JSON upload

@Controller('vault')
export class VaultController {
  private readonly logger = new Logger(VaultController.name);

  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /api/v1/vault/export
   *
   * Streams the full vault as a JSON download. The response includes a
   * Content-Disposition header so browsers save it with a sensible filename.
   * Use `?collectionId=<uuid>` to scope the export to one collection; by
   * default all collections the caller can read are included.
   */
  @Get('export')
  async exportVault(
    @Res() reply: FastifyReply,
    @Query('collectionId') collectionId?: string,
    @Query('includeConversations') includeConversations?: string,
  ): Promise<void> {
    const payload = await this.queryBus.execute<ExportVaultQuery, VaultExportPayload>(
      new ExportVaultQuery({
        collectionId,
        includeConversations: includeConversations === 'false' ? false : true,
      }),
    );

    const filename = `piper-vault-export-${new Date().toISOString().slice(0, 10)}.json`;
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('X-Vault-Format-Version', String(VAULT_EXPORT_FORMAT_VERSION))
      .send(payload);
  }

  /**
   * POST /api/v1/vault/import
   *
   * Restores a previously exported vault. Expects the JSON payload produced
   * by GET /vault/export in the request body. Upserts by primary key, so
   * re-importing the same payload is a no-op.
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importVault(@Body() body: unknown): Promise<ImportVaultResult> {
    if (body === undefined || body === null) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Request body is required' },
      });
    }

    const approxBytes = JSON.stringify(body).length;
    if (approxBytes > MAX_IMPORT_BYTES) {
      throw new BadRequestException({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Import payload is ${approxBytes} bytes; maximum is ${MAX_IMPORT_BYTES}`,
        },
      });
    }

    const validation = validateVaultExportPayload(body);
    if (!validation.ok) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_VAULT_PAYLOAD',
          message: 'Vault export payload failed validation',
          details: validation.errors,
        },
      });
    }

    const payload = body as VaultExportPayload;
    const result = await this.commandBus.execute<ImportVaultCommand, ImportVaultResult>(
      new ImportVaultCommand(payload),
    );

    this.logger.log(
      `Vault import complete: ${JSON.stringify(result.imported)}; reprocess recommended: ${result.reprocessRecommended}`,
    );
    return result;
  }
}
