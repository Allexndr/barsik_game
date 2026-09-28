import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { LoginRateLimiter, clientAddress } = require('../server/loginRateLimiter.cjs') as {
  LoginRateLimiter: new (options?: { windowMs?: number; maxFailures?: number; maxEntries?: number }) => {
    isBlocked: (key: string, now?: number) => boolean;
    recordFailure: (key: string, now?: number) => void;
    recordSuccess: (key: string) => void;
  };
  clientAddress: (request: { headers: Record<string, string>; socket: { remoteAddress?: string } }) => string;
};

describe('login rate limiter', () => {
  it('blocks after repeated failures and expires the block', () => {
    const limiter = new LoginRateLimiter({ windowMs: 1_000, maxFailures: 3 });
    limiter.recordFailure('192.0.2.1', 100);
    limiter.recordFailure('192.0.2.1', 200);
    expect(limiter.isBlocked('192.0.2.1', 300)).toBe(false);
    limiter.recordFailure('192.0.2.1', 300);
    expect(limiter.isBlocked('192.0.2.1', 301)).toBe(true);
    expect(limiter.isBlocked('192.0.2.1', 1_301)).toBe(false);
  });

  it('clears failures after a successful login and isolates clients', () => {
    const limiter = new LoginRateLimiter({ maxFailures: 2 });
    limiter.recordFailure('192.0.2.1', 100);
    limiter.recordFailure('192.0.2.1', 200);
    limiter.recordFailure('192.0.2.2', 200);
    limiter.recordSuccess('192.0.2.1');
    expect(limiter.isBlocked('192.0.2.1', 201)).toBe(false);
    expect(limiter.isBlocked('192.0.2.2', 201)).toBe(false);
  });

  it('uses the proxy-overwritten X-Real-IP and ignores client-controlled X-Forwarded-For', () => {
    expect(clientAddress({
      headers: { 'x-real-ip': '203.0.113.8', 'x-forwarded-for': '198.51.100.9' },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('203.0.113.8');
    expect(clientAddress({
      headers: { 'x-forwarded-for': '198.51.100.9' },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('127.0.0.1');
  });
});
