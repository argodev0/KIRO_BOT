export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RequestRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private requests: Map<string, RequestRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // Clean up expired records every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  public checkLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now >= record.resetTime) {
      // First request or window expired
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment count
    record.count++;
    return true;
  }

  public getRemainingRequests(identifier: string): number {
    const record = this.requests.get(identifier);
    if (!record || Date.now() >= record.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - record.count);
  }

  public getResetTime(identifier: string): number {
    const record = this.requests.get(identifier);
    if (!record || Date.now() >= record.resetTime) {
      return Date.now() + this.windowMs;
    }
    return record.resetTime;
  }

  public reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  public resetAll(): void {
    this.requests.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [identifier, record] of this.requests.entries()) {
      if (now >= record.resetTime) {
        this.requests.delete(identifier);
      }
    }
  }

  public getStats() {
    return {
      totalIdentifiers: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }
}