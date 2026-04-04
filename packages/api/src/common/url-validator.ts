import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Validates that a URL points to a public (non-private) host.
 * Prevents SSRF attacks by blocking requests to internal networks,
 * cloud metadata endpoints, and loopback addresses.
 *
 * @throws BadRequestException if the URL targets a private/reserved IP
 */
export async function validatePublicUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException({
      error: { code: 'SSRF_BLOCKED', message: 'Invalid URL' },
    });
  }

  // Only allow http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException({
      error: {
        code: 'SSRF_BLOCKED',
        message: 'Only http and https URLs are allowed',
      },
    });
  }

  const hostname = parsed.hostname;

  // Block well-known private hostnames
  const blockedHostnames = ['localhost', '0.0.0.0', '[::]', '[::1]'];
  if (blockedHostnames.includes(hostname.toLowerCase())) {
    throw new BadRequestException({
      error: {
        code: 'SSRF_BLOCKED',
        message: 'URLs targeting private or loopback addresses are not allowed',
      },
    });
  }

  // Resolve hostname to IP and check against private ranges
  let ip: string;
  if (isIP(hostname)) {
    ip = hostname;
  } else {
    try {
      const result = await lookup(hostname);
      ip = result.address;
    } catch {
      throw new BadRequestException({
        error: {
          code: 'SSRF_BLOCKED',
          message: 'Could not resolve hostname',
        },
      });
    }
  }

  if (isPrivateIP(ip)) {
    throw new BadRequestException({
      error: {
        code: 'SSRF_BLOCKED',
        message: 'URLs targeting private or reserved IP addresses are not allowed',
      },
    });
  }
}

function isPrivateIP(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;

    // 127.0.0.0/8  — loopback
    if (a === 127) return true;
    // 10.0.0.0/8   — private
    if (a === 10) return true;
    // 172.16.0.0/12 — private
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 — private
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 — link-local / cloud metadata
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 — unspecified
    if (a === 0) return true;

    return false;
  }

  // IPv6 private/reserved ranges
  if (isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    // ::1 — loopback
    if (normalized === '::1') return true;
    // :: — unspecified
    if (normalized === '::') return true;
    // fc00::/7 — unique local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // fe80::/10 — link-local
    if (normalized.startsWith('fe80')) return true;

    return false;
  }

  // Not a valid IP — block by default
  return true;
}
