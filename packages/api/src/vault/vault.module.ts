import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { VaultController } from './vault.controller';
import { ExportVaultHandler } from './queries/export-vault.handler';
import { ImportVaultHandler } from './commands/import-vault.handler';

const QueryHandlers = [ExportVaultHandler];
const CommandHandlers = [ImportVaultHandler];

@Module({
  imports: [CqrsModule],
  controllers: [VaultController],
  providers: [...QueryHandlers, ...CommandHandlers],
})
export class VaultModule {}
