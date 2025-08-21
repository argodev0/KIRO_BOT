import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '@/utils/RateLimiter';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';


interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiting middleware
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const rateLimiter = new RateLimiter({
    windowMs: options.windowMs,
    maxRequests: options.maxRequests
  });
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || 'unknown');
      
      const allowed = rateLimiter.checkLimit(key);
      const remaining = rateLimiter.getRemainingRequests(key);
      const resetTime = rateLimiter.getResetTime(key);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(),
        'X-RateLimit-Window': options.windowMs.toString()
      });
      
      if (!allowed) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.set('Retry-After', retryAfter.toString());
        
        logger.warn(`Rate limit exceeded for ${key}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
        
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: options.message || 'Too many requests, please try again later',
          retryAfter,
          limit: options.maxRequests,
          windowMs: options.windowMs
        });
        return;
      }
      
      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      next(); // Continue on rate limiter errors
    }
  };
};

/**
 * General API rate limiter
 */
export const apiRateLimit = createRateLimit({
  windowMs: config.security.rateLimitWindowMs,
  maxRequests: config.security.rateLimitMax,
  message: 'Too many API requests, please try again later'
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req: Request) => {
    // Use IP + email for auth endpoints to prevent abuse
    const email = req.body?.email || '';
    return `${req.ip}:${email}`;
  }
});

/**
 * Trading endpoints rate limiter
 */
export const tradingRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 trading requests per minute
  message: 'Too many trading requests, please slow down',
  keyGenerator: (req: Request) => {
    // Use user ID for authenticated trading requests
    const userId = (req as any).user?.userId;
    return userId ? `trading:${userId}` : `trading:${req.ip}`;
  }
});

/**
 * WebSocket rate limiter
 */
export const websocketRateLimit = createRateLimit({
  windowMs: config.websocket.rateLimit.windowMs,
  maxRequests: config.websocket.rateLimit.maxRequests,
  message: 'Too many WebSocket requests'
});

/**
 * Admin endpoints rate limiter
 */
export const adminRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 admin requests per minute
  message: 'Too many admin requests'
});

/**
 * Password reset rate limiter
 */
export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password reset attempts per hour
  message: 'Too many password reset attempts, please try again later',
  keyGenerator: (req: Request) => {
    const email = req.body?.email || '';
    return `password-reset:${req.ip}:${email}`;
  }
});

/**
 * Registration rate limiter
 */
export const registrationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 registrations per hour per IP
  message: 'Too many registration attempts, please try again later'
});

/**
 * Export rate limiter (for analytics exports)
 */
export const exportRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 exports per hour
  message: 'Too many export requests, please try again later',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId;
    return userId ? `export:${userId}` : `export:${req.ip}`;
  }
});