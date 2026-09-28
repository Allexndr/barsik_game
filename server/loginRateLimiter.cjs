const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_MAX_ENTRIES = 5_000;

class LoginRateLimiter {
  constructor({
    windowMs = DEFAULT_WINDOW_MS,
    maxFailures = DEFAULT_MAX_FAILURES,
    maxEntries = DEFAULT_MAX_ENTRIES,
  } = {}) {
    this.windowMs = windowMs;
    this.maxFailures = maxFailures;
    this.maxEntries = maxEntries;
    this.failures = new Map();
  }

  isBlocked(key, now = Date.now()) {
    this.prune(now);
    const entry = this.failures.get(key);
    return Boolean(entry && entry.blockedUntil > now);
  }

  recordFailure(key, now = Date.now()) {
    this.prune(now);
    let entry = this.failures.get(key);
    if (!entry || now - entry.windowStartedAt >= this.windowMs) {
      entry = { count: 0, windowStartedAt: now, blockedUntil: 0 };
    }
    entry.count += 1;
    if (entry.count >= this.maxFailures) entry.blockedUntil = now + this.windowMs;
    this.failures.delete(key);
    this.failures.set(key, entry);
  }

  recordSuccess(key) {
    this.failures.delete(key);
  }

  prune(now) {
    for (const [key, entry] of this.failures) {
      if (now - entry.windowStartedAt >= this.windowMs && entry.blockedUntil <= now) {
        this.failures.delete(key);
      }
    }
    while (this.failures.size >= this.maxEntries) {
      this.failures.delete(this.failures.keys().next().value);
    }
  }
}

function clientAddress(req) {
  const trustedProxyAddress = req.headers['x-real-ip'];
  if (typeof trustedProxyAddress === 'string' && trustedProxyAddress.trim()) {
    return trustedProxyAddress.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

module.exports = { LoginRateLimiter, clientAddress };
