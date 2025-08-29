import { logger } from '@/utils/logger';

export interface LockoutRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

export interface AccountLockoutOptions {
  maxAttempts: number;
  lockoutDuration: number; // in milliseconds
  windowDuration: number; // in milliseconds
}

export class AccountLockoutService {
  private static instance: AccountLockoutService;
  private lockoutRecords: Map<string, LockoutRecord> = new Map();
  private options: AccountLockoutOptions;

  constructor(options: AccountLockoutOptions = {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    windowDuration: 15 * 60 * 1000 // 15 minutes
  }) {
    this.options = options;
    
    // Clean up expired records every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  public static getInstance(options?: AccountLockoutOptions): AccountLockoutService {
    if (!AccountLockoutService.instance) {
      AccountLockoutService.instance = new AccountLockoutService(options);
    }
    return AccountLockoutService.instance;
  }

  /**
   * Record a failed login attempt
   */
  public recordFailedAttempt(identifier: string): boolean {
    const now = Date.now();
    const record = this.lockoutRecords.get(identifier) || {
      attempts: 0,
      lastAttempt: 0
    };

    // Check if account is currently locked
    if (record.lockedUntil && now < record.lockedUntil) {
      logger.warn(`Account lockout: ${identifier} is locked until ${new Date(record.lockedUntil).toISOString()}`);
      return false; // Account is locked
    }

    // Reset attempts if window has expired
    if (now - record.lastAttempt > this.options.windowDuration) {
      record.attempts = 0;
    }

    // Increment attempts
    record.attempts++;
    record.lastAttempt = now;

    // Check if we should lock the account
    if (record.attempts >= this.options.maxAttempts) {
      record.lockedUntil = now + this.options.lockoutDuration;
      
      logger.error(`Account locked due to too many failed attempts`, {
        identifier,
        attempts: record.attempts,
        lockedUntil: new Date(record.lockedUntil).toISOString(),
        lockoutDuration: this.options.lockoutDuration
      });
    }

    this.lockoutRecords.set(identifier, record);
    
    return record.lockedUntil ? false : true; // Return false if locked
  }

  /**
   * Record a successful login (clears failed attempts)
   */
  public recordSuccessfulAttempt(identifier: string): void {
    this.lockoutRecords.delete(identifier);
    logger.debug(`Cleared failed attempts for ${identifier}`);
  }

  /**
   * Check if an account is currently locked
   */
  public isLocked(identifier: string): boolean {
    const record = this.lockoutRecords.get(identifier);
    if (!record || !record.lockedUntil) {
      return false;
    }

    const now = Date.now();
    if (now >= record.lockedUntil) {
      // Lock has expired, remove it
      record.lockedUntil = undefined;
      return false;
    }

    return true;
  }

  /**
   * Get remaining lockout time in milliseconds
   */
  public getRemainingLockoutTime(identifier: string): number {
    const record = this.lockoutRecords.get(identifier);
    if (!record || !record.lockedUntil) {
      return 0;
    }

    const remaining = record.lockedUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get failed attempt count
   */
  public getFailedAttempts(identifier: string): number {
    const record = this.lockoutRecords.get(identifier);
    if (!record) {
      return 0;
    }

    // Check if attempts are within the window
    const now = Date.now();
    if (now - record.lastAttempt > this.options.windowDuration) {
      return 0;
    }

    return record.attempts;
  }

  /**
   * Manually unlock an account (admin function)
   */
  public unlockAccount(identifier: string): void {
    this.lockoutRecords.delete(identifier);
    logger.info(`Account manually unlocked: ${identifier}`);
  }

  /**
   * Get lockout status for an identifier
   */
  public getLockoutStatus(identifier: string): {
    isLocked: boolean;
    attempts: number;
    remainingTime: number;
    maxAttempts: number;
  } {
    return {
      isLocked: this.isLocked(identifier),
      attempts: this.getFailedAttempts(identifier),
      remainingTime: this.getRemainingLockoutTime(identifier),
      maxAttempts: this.options.maxAttempts
    };
  }

  /**
   * Clean up expired records
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [identifier, record] of this.lockoutRecords.entries()) {
      // Remove if lockout has expired and no recent attempts
      if (
        (!record.lockedUntil || now >= record.lockedUntil) &&
        (now - record.lastAttempt > this.options.windowDuration)
      ) {
        this.lockoutRecords.delete(identifier);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired lockout records`);
    }
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalRecords: number;
    lockedAccounts: number;
    recentAttempts: number;
    options: AccountLockoutOptions;
  } {
    const now = Date.now();
    let lockedAccounts = 0;
    let recentAttempts = 0;

    for (const record of this.lockoutRecords.values()) {
      if (record.lockedUntil && now < record.lockedUntil) {
        lockedAccounts++;
      }
      if (now - record.lastAttempt <= this.options.windowDuration) {
        recentAttempts++;
      }
    }

    return {
      totalRecords: this.lockoutRecords.size,
      lockedAccounts,
      recentAttempts,
      options: this.options
    };
  }

  /**
   * Create middleware for Express
   */
  public middleware() {
    return (req: any, res: any, next: any) => {
      const identifier = this.getIdentifier(req);
      
      if (this.isLocked(identifier)) {
        const remainingTime = this.getRemainingLockoutTime(identifier);
        const retryAfter = Math.ceil(remainingTime / 1000);
        
        res.set('Retry-After', retryAfter.toString());
        return res.status(423).json({
          error: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed attempts',
          retryAfter,
          remainingTime
        });
      }

      // Store lockout service in request for use in auth handlers
      req.accountLockout = this;
      next();
    };
  }

  /**
   * Get identifier from request (IP + email if available)
   */
  private getIdentifier(req: any): string {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = req.body?.email || req.query?.email || '';
    return email ? `${ip}:${email}` : ip;
  }
}

export default AccountLockoutService;