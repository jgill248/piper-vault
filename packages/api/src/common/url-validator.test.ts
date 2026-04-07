import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';

// Mock dns lookup so tests don't make real network calls
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

import { validatePublicUrl } from './url-validator';
import { lookup } from 'node:dns/promises';

const mockedLookup = vi.mocked(lookup);

async function expectSsrfBlocked(urlPromise: Promise<void>): Promise<void> {
  try {
    await urlPromise;
    expect.fail('Expected BadRequestException to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as {
      error: { code: string };
    };
    expect(body.error.code).toBe('SSRF_BLOCKED');
  }
}

describe('validatePublicUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- Happy path ---

  it('allows a public URL', async () => {
    mockedLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 } as never);
    await expect(validatePublicUrl('https://example.com')).resolves.toBeUndefined();
  });

  it('allows a public IP directly', async () => {
    await expect(validatePublicUrl('https://93.184.216.34')).resolves.toBeUndefined();
  });

  // --- Protocol enforcement ---

  it('rejects non-http protocols (ftp)', async () => {
    await expectSsrfBlocked(validatePublicUrl('ftp://example.com'));
  });

  it('rejects file:// protocol', async () => {
    await expectSsrfBlocked(validatePublicUrl('file:///etc/passwd'));
  });

  it('rejects invalid URLs', async () => {
    await expectSsrfBlocked(validatePublicUrl('not-a-url'));
  });

  // --- Blocked hostnames ---

  it('blocks localhost', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://localhost/path'));
  });

  it('blocks 0.0.0.0', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://0.0.0.0'));
  });

  // --- Private IPv4 ranges ---

  it('blocks 127.0.0.1 (loopback)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://127.0.0.1'));
  });

  it('blocks 10.x.x.x (private)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://10.0.0.1'));
  });

  it('blocks 172.16.x.x (private)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://172.16.0.1'));
  });

  it('blocks 192.168.x.x (private)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://192.168.1.1'));
  });

  it('blocks 169.254.x.x (link-local / cloud metadata)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://169.254.169.254'));
  });

  it('blocks multicast range (224.0.0.0/4)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://224.0.0.1'));
  });

  it('blocks reserved range (240.0.0.0/4)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://240.0.0.1'));
  });

  it('blocks broadcast (255.255.255.255)', async () => {
    await expectSsrfBlocked(validatePublicUrl('http://255.255.255.255'));
  });

  // --- IPv6-mapped IPv4 bypass ---

  it('blocks ::ffff:127.0.0.1 (IPv6-mapped loopback)', async () => {
    mockedLookup.mockResolvedValue({ address: '::ffff:127.0.0.1', family: 6 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://mapped.example.com'));
  });

  it('blocks ::ffff:10.0.0.1 (IPv6-mapped private)', async () => {
    mockedLookup.mockResolvedValue({ address: '::ffff:10.0.0.1', family: 6 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://mapped-private.example.com'));
  });

  it('blocks ::ffff:192.168.1.1 (IPv6-mapped private)', async () => {
    mockedLookup.mockResolvedValue({ address: '::ffff:192.168.1.1', family: 6 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://mapped-lan.example.com'));
  });

  // --- IPv6 private ---

  it('blocks ::1 (IPv6 loopback)', async () => {
    mockedLookup.mockResolvedValue({ address: '::1', family: 6 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://ipv6-loop.example.com'));
  });

  it('blocks fc00:: (unique local)', async () => {
    mockedLookup.mockResolvedValue({ address: 'fc00::1', family: 6 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://unique-local.example.com'));
  });

  it('blocks fe80:: (link-local)', async () => {
    mockedLookup.mockResolvedValue({ address: 'fe80::1', family: 6 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://link-local.example.com'));
  });

  // --- DNS resolution failure ---

  it('rejects when DNS lookup fails', async () => {
    mockedLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expectSsrfBlocked(validatePublicUrl('http://nonexistent.invalid'));
  });

  // --- DNS resolving to private IP ---

  it('blocks hostname that resolves to private IP', async () => {
    mockedLookup.mockResolvedValue({ address: '192.168.1.100', family: 4 } as never);
    await expectSsrfBlocked(validatePublicUrl('http://sneaky.example.com'));
  });
});
