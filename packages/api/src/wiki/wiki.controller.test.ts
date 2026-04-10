import { describe, it, expect, vi } from 'vitest';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { WikiController } from './wiki.controller';
import { InitializeWikiCommand } from './commands/initialize-wiki.command';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommandBus(result: unknown = { ok: true, value: { totalEligible: 2, sourcesProcessed: 2, sourcesSkipped: 0, errors: [], summary: 'Done' } }) {
  return {
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as CommandBus;
}

function makeQueryBus() {
  return {
    execute: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  } as unknown as QueryBus;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WikiController', () => {
  describe('POST /wiki/initialize', () => {
    it('dispatches InitializeWikiCommand and returns result', async () => {
      const expectedResult = {
        ok: true,
        value: {
          totalEligible: 3,
          sourcesProcessed: 3,
          sourcesSkipped: 0,
          errors: [],
          summary: 'Wiki initialization complete: 3 source(s) processed, 0 skipped, 0 error(s)',
        },
      };
      const commandBus = makeCommandBus(expectedResult);
      const queryBus = makeQueryBus();
      const controller = new WikiController(commandBus, queryBus);

      const result = await controller.initialize({});

      expect(result).toEqual(expectedResult);
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const cmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(cmd).toBeInstanceOf(InitializeWikiCommand);
      expect(cmd.collectionId).toBeUndefined();
    });

    it('passes collectionId to the command', async () => {
      const commandBus = makeCommandBus();
      const queryBus = makeQueryBus();
      const controller = new WikiController(commandBus, queryBus);

      await controller.initialize({ collectionId: 'my-collection' });

      const cmd = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(cmd).toBeInstanceOf(InitializeWikiCommand);
      expect(cmd.collectionId).toBe('my-collection');
    });

    it('returns error result when wiki is disabled', async () => {
      const errorResult = { ok: false, error: 'Wiki is not enabled. Enable it in Settings first.' };
      const commandBus = makeCommandBus(errorResult);
      const queryBus = makeQueryBus();
      const controller = new WikiController(commandBus, queryBus);

      const result = await controller.initialize({});

      expect(result).toEqual(errorResult);
    });
  });
});
