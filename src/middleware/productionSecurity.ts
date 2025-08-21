/**
 * Production Security Middleware
 * Comprehensive security headers and rate limiting for production environment
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { productionLogger } from '../services/ProductionLoggingService';
import { auditService } from '../services/AuditService';

interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  slowDown: {
    windowMs: number;
    delayAfter: number;
    delayMs: number;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
}

export class ProductionSecurityMiddleware {
  private redis: Redis;
  private rateLimiters: Map<string, RateLimiterRedis>;
  private config: SecurityConfig;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.rateLimiters = new Map();
    this.config = this.loadSecurityConfig();
    this.initializeRateLimiters();
  }

  private loadSecurityConfig(): SecurityConfig {
    return {
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true'
      },
      slowDown: {
        windowMs: parseInt(process.env.SLOW_DOWN_WINDOW_MS || '900000'), // 15 minutes
        delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER || '100'),
        delayMs: parseInt(process.env.SLOW_DOWN_DELAY_MS || '500')
      },
      helmet: {
        contentSecurityPolicy: process.env.CSP_ENABLED !== 'false',
        crossOriginEmbedderPolicy: process.env.COEP_ENABLED !== 'false',
        hsts: {
          maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'), // 1 year
          includeSubDomains: true,
          preload: true
        }
      }
    };
  }

  private initializeRateLimiters(): void {
    // General API rate limiter
    this.rateLimiters.set('api', new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_api',
      points: 1000, // Number of requests
      duration: 900, // Per 15 minutes
      blockDuration: 900, // Block for 15 minutes if limit exceeded
    }));

    // Authentication rate limiter (stricter)
    this.rateLimiters.set('auth', new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_auth',
      points: 10, // Number of attempts
      duration: 900, // Per 15 minutes
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    }));

    // Trading API rate limiter
    this.rateLimiters.set('trading', new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_trading',
      points: 100, // Number of trading requests
      duration: 60, // Per minute
      blockDuration: 300, // Block for 5 minutes if limit exceeded
    }));

    // Password reset rate limiter
    this.rateLimiters.set('password_reset', new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_pwd_reset',
      points: 3, // Number of reset attempts
      duration: 3600, // Per hour
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    }));

    // Registration rate limiter
    this.rateLimiters.set('registration', new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_register',
      points: 5, // Number of registration attempts
      duration: 3600, // Per hour
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    }));

    // Admin API rate limiter (very strict)
    this.rateLimiters.set('admin', new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl_admin',
      points: 50, // Number of admin requests
      duration: 3600, // Per hour
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    }));
  }

  /**
   * Security headers middleware using Helmet
   */
  public securityHeaders() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: this.config.helmet.contentSecurityPolicy ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for some UI libraries
            "https://fonts.googleapis.com",
            "https://cdn.jsdelivr.net"
          ],
          scriptSrc: [
            "'self'",
            "https://cdn.jsdelivr.net",
            "https://unpkg.com",
            "'unsafe-eval'" // Required for TradingView charts
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdn.jsdelivr.net"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "blob:"
          ],
          connectSrc: [
            "'self'",
            "https://api.binance.com",
            "https://api.kucoin.com",
            "wss://stream.binance.com",
            "wss://ws-api.kucoin.com"
          ],
          frameSrc: [
            "'self'",
            "https://www.tradingview.com"
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      } : false,

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: this.config.helmet.crossOriginEmbedderPolicy,

      // HTTP Strict Transport Security
      hsts: {
        maxAge: this.config.helmet.hsts.maxAge,
        includeSubDomains: this.config.helmet.hsts.includeSubDomains,
        preload: this.config.helmet.hsts.preload
      },

      // Additional security headers
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      
      // Permissions Policy (formerly Feature Policy)
      permittedCrossDomainPolicies: false,
      
      // Custom headers
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    });
  }

  /**
   * Additional custom security headers
   */
  public customSecurityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // API versioning
      res.setHeader('API-Version', process.env.API_VERSION || 'v1');
      
      // Rate limit headers (will be set by rate limiting middleware)
      res.setHeader('X-RateLimit-Limit', this.config.rateLimit.max.toString());
      
      // Security contact
      res.setHeader('Security-Contact', 'security@yourdomain.com');
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  /**
   * General rate limiting middleware
   */
  public generalRateLimit() {
    return rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      skipSuccessfulRequests: this.config.rateLimit.skipSuccessfulRequests,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        return this.getClientIdentifier(req);
      },
      handler: (req: Request, res: Response) => {
        const clientId = this.getClientIdentifier(req);
        
        productionLogger.warn('Rate limit exceeded', {
          clientId,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ipAddress: this.getClientIP(req)
        });

        auditService.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'medium',
          userId: (req as any).user?.id,
          ipAddress: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
          details: {
            reason: 'rate_limit_exceeded',
            path: req.path,
            method: req.method
          }
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000)
        });
      }
    });
  }

  /**
   * Slow down middleware for gradual response delays
   */
  public slowDownMiddleware() {
    return slowDown({
      windowMs: this.config.slowDown.windowMs,
      delayAfter: this.config.slowDown.delayAfter,
      delayMs: this.config.slowDown.delayMs,
      keyGenerator: (req: Request) => {
        return this.getClientIdentifier(req);
      }
    });
  }

  /**
   * Advanced rate limiting with Redis
   */
  public advancedRateLimit(limiterType: string = 'api') {
    return async (req: Request, res: Response, next: NextFunction) => {
      const limiter = this.rateLimiters.get(limiterType);
      if (!limiter) {
        return next();
      }

      const clientId = this.getClientIdentifier(req);

      try {
        const result = await limiter.consume(clientId);
        
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limiter.points);
        res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext));

        next();
      } catch (rejRes: any) {
        // Rate limit exceeded
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        res.setHeader('Retry-After', secs);
        res.setHeader('X-RateLimit-Limit', limiter.points);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext));

        productionLogger.warn('Advanced rate limit exceeded', {
          limiterType,
          clientId,
          path: req.path,
          method: req.method,
          retryAfter: secs
        });

        auditService.logSecurityEvent({
          type: 'suspicious_activity',
          severity: limiterType === 'auth' ? 'high' : 'medium',
          userId: (req as any).user?.id,
          ipAddress: this.getClientIP(req),
          userAgent: req.get('User-Agent'),
          details: {
            reason: 'advanced_rate_limit_exceeded',
            limiterType,
            path: req.path,
            method: req.method,
            retryAfter: secs
          }
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${limiterType}. Please try again later.`,
          retryAfter: secs
        });
      }
    };
  }

  /**
   * Authentication-specific rate limiting
   */
  public authRateLimit() {
    return this.advancedRateLimit('auth');
  }

  /**
   * Trading-specific rate limiting
   */
  public tradingRateLimit() {
    return this.advancedRateLimit('trading');
  }

  /**
   * Admin-specific rate limiting
   */
  public adminRateLimit() {
    return this.advancedRateLimit('admin');
  }

  /**
   * Password reset rate limiting
   */
  public passwordResetRateLimit() {
    return this.advancedRateLimit('password_reset');
  }

  /**
   * Registration rate limiting
   */
  public registrationRateLimit() {
    return this.advancedRateLimit('registration');
  }

  /**
   * IP-based blocking middleware
   */
  public ipBlocking() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);
      
      // Check if IP is in blocklist
      const isBlocked = await this.redis.get(`blocked_ip:${clientIP}`);
      if (isBlocked) {
        productionLogger.warn('Blocked IP attempted access', {
          ipAddress: clientIP,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent')
        });

        auditService.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          ipAddress: clientIP,
          userAgent: req.get('User-Agent'),
          details: {
            reason: 'blocked_ip_access_attempt',
            path: req.path,
            method: req.method
          }
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      next();
    };
  }

  /**
   * Suspicious activity detection
   */
  public suspiciousActivityDetection() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);
      const userAgent = req.get('User-Agent') || '';
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /hack/i,
        /exploit/i
      ];

      const isSuspiciousUserAgent = suspiciousPatterns.some(pattern => 
        pattern.test(userAgent)
      );

      // Check for suspicious request patterns
      const suspiciousPaths = [
        '/admin',
        '/.env',
        '/config',
        '/backup',
        '/wp-admin',
        '/phpmyadmin'
      ];

      const isSuspiciousPath = suspiciousPaths.some(path => 
        req.path.toLowerCase().includes(path)
      );

      if (isSuspiciousUserAgent || isSuspiciousPath) {
        // Increment suspicious activity counter
        const key = `suspicious:${clientIP}`;
        const count = await this.redis.incr(key);
        await this.redis.expire(key, 3600); // 1 hour expiry

        if (count > 5) {
          // Block IP for 24 hours
          await this.redis.setex(`blocked_ip:${clientIP}`, 86400, 'suspicious_activity');
          
          productionLogger.error('IP blocked due to suspicious activity', {
            ipAddress: clientIP,
            userAgent,
            path: req.path,
            suspiciousCount: count
          });

          auditService.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'critical',
            ipAddress: clientIP,
            userAgent,
            details: {
              reason: 'ip_blocked_suspicious_activity',
              path: req.path,
              method: req.method,
              suspiciousCount: count
            }
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied due to suspicious activity'
          });
        }

        productionLogger.warn('Suspicious activity detected', {
          ipAddress: clientIP,
          userAgent,
          path: req.path,
          suspiciousCount: count
        });
      }

      next();
    };
  }

  /**
   * CORS configuration for production
   */
  public corsConfiguration() {
    return (req: Request, res: Response, next: NextFunction) => {
      const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',');
      const origin = req.get('Origin');

      if (allowedOrigins.includes(origin || '')) {
        res.setHeader('Access-Control-Allow-Origin', origin || '');
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * Request size limiting
   */
  public requestSizeLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      const maxSize = parseInt(process.env.MAX_REQUEST_SIZE || '10485760'); // 10MB default
      
      if (req.get('Content-Length')) {
        const contentLength = parseInt(req.get('Content-Length') || '0');
        if (contentLength > maxSize) {
          productionLogger.warn('Request size limit exceeded', {
            contentLength,
            maxSize,
            path: req.path,
            ipAddress: this.getClientIP(req)
          });

          return res.status(413).json({
            error: 'Payload Too Large',
            message: 'Request size exceeds maximum allowed size'
          });
        }
      }

      next();
    };
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientIdentifier(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = (req as any).user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    
    return `ip:${this.getClientIP(req)}`;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string) ||
           (req.headers['x-real-ip'] as string) ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Block IP address
   */
  public async blockIP(ip: string, duration: number = 86400, reason: string = 'manual'): Promise<void> {
    await this.redis.setex(`blocked_ip:${ip}`, duration, reason);
    
    productionLogger.warn('IP address blocked', {
      ipAddress: ip,
      duration,
      reason
    });

    auditService.logSecurityEvent({
      type: 'authorization',
      severity: 'high',
      ipAddress: ip,
      details: {
        action: 'ip_blocked',
        reason,
        duration
      }
    });
  }

  /**
   * Unblock IP address
   */
  public async unblockIP(ip: string): Promise<void> {
    await this.redis.del(`blocked_ip:${ip}`);
    
    productionLogger.info('IP address unblocked', {
      ipAddress: ip
    });

    auditService.logSecurityEvent({
      type: 'authorization',
      severity: 'medium',
      ipAddress: ip,
      details: {
        action: 'ip_unblocked'
      }
    });
  }

  /**
   * Get rate limit status for client
   */
  public async getRateLimitStatus(clientId: string, limiterType: string = 'api'): Promise<any> {
    const limiter = this.rateLimiters.get(limiterType);
    if (!limiter) {
      return null;
    }

    try {
      const result = await limiter.get(clientId);
      return {
        limit: limiter.points,
        remaining: result ? result.remainingPoints : limiter.points,
        reset: result ? new Date(Date.now() + result.msBeforeNext) : new Date(),
        blocked: result ? result.msBeforeNext > 0 && result.remainingPoints === 0 : false
      };
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const productionSecurity = new ProductionSecurityMiddleware();