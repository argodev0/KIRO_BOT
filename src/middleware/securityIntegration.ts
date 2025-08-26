/**
 * Security Integration Middleware
 * Comprehensive security middleware stack for production deployment
 */

import { Express, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { productionSecurityConfig, validateProductionSecurityConfig } from '@/config/productionSecurity';

// Import security middleware components
import { 
  securityHeaders, 
  corsOptions, 
  forceHTTPS,
  validateRequest,
  validateContent,
  requestId,
  responseTime,
  productionSecurityStack
} from './security';

import { 
  comprehensiveValidation,
  validate,
  preventSQLInjection,
  preventXSS,
  preventPathTraversal,
  preventCommandInjection
} from './inputValidation';

import {
  apiRateLimit,
  authRateLimit,
  tradingRateLimit,
  adminRateLimit,
  createRateLimit
} from './rateLimiter';

import { productionSecurity } from './productionSecurity';
import { createProductionSecurityHardening } from './productionSecurityHardening';

// Import services
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { AuditLogService } from '@/services/AuditLogService';
import { NotificationService } from '@/services/NotificationService';

export interface SecurityIntegrationOptions {
  enableRateLimiting?: boolean;
  enableIntrusionDetection?: boolean;
  enableAuditLogging?: boolean;
  enableSecurityMonitoring?: boolean;
  enableApiKeyValidation?: boolean;
  enableCORS?: boolean;
  enableSecurityHeaders?: boolean;
  customSecurityRules?: Array<(req: Request, res: Response, next: NextFunction) => void>;
}

export class SecurityIntegration {
  private app: Express;
  private prisma: PrismaClient;
  private securityMonitoring: SecurityMonitoringService;
  private auditService: AuditLogService;
  private notificationService: NotificationService;
  private productionSecurityHardening: any;
  private options: SecurityIntegrationOptions;

  constructor(
    app: Express,
    prisma: PrismaClient,
    options: SecurityIntegrationOptions = {}
  ) {
    this.app = app;
    this.prisma = prisma;
    this.options = {
      enableRateLimiting: true,
      enableIntrusionDetection: true,
      enableAuditLogging: true,
      enableSecurityMonitoring: true,
      enableApiKeyValidation: true,
      enableCORS: true,
      enableSecurityHeaders: true,
      ...options
    };

    this.initializeServices();
    this.validateConfiguration();
  }

  /**
   * Initialize security services
   */
  private initializeServices(): void {
    try {
      // Initialize core services
      this.auditService = new AuditLogService(this.prisma);
      this.notificationService = new NotificationService();
      this.securityMonitoring = new SecurityMonitoringService(
        this.prisma,
        this.auditService,
        this.notificationService
      );

      // Initialize production security hardening
      this.productionSecurityHardening = createProductionSecurityHardening(
        this.securityMonitoring,
        this.auditService
      );

      logger.info('Security services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize security services:', error);
      throw new Error('Security initialization failed');
    }
  }

  /**
   * Validate security configuration
   */
  private validateConfiguration(): void {
    const validation = validateProductionSecurityConfig();
    
    if (!validation.valid) {
      logger.error('Security configuration validation failed:', validation.errors);
      throw new Error(`Security configuration invalid: ${validation.errors.join(', ')}`);
    }

    // Additional production-specific validations
    if (config.env === 'production') {
      if (!config.paperTradingMode) {
        throw new Error('Paper trading mode must be enabled in production');
      }

      if (!process.env.REDIS_URL) {
        throw new Error('Redis URL is required for production security features');
      }
    }

    logger.info('Security configuration validated successfully');
  }

  /**
   * Apply comprehensive security middleware stack
   */
  public applySecurityMiddleware(): void {
    logger.info('Applying comprehensive security middleware stack...');

    // 1. Request ID and response time tracking (first)
    this.app.use(requestId);
    this.app.use(responseTime);

    // 2. Security headers (early in the stack)
    if (this.options.enableSecurityHeaders) {
      this.app.use(productionSecurity.securityHeaders());
      this.app.use(productionSecurity.customSecurityHeaders());
      this.app.use(securityHeaders);
    }

    // 3. CORS configuration
    if (this.options.enableCORS) {
      this.app.use(this.productionSecurityHardening.enhancedCORS());
      this.app.use(corsOptions);
    }

    // 4. HTTPS enforcement (production only)
    if (config.env === 'production') {
      this.app.use(forceHTTPS);
    }

    // 5. Request size and structure validation
    this.app.use(productionSecurity.requestSizeLimit());
    this.app.use(validateRequest);

    // 6. IP blocking and suspicious activity detection
    this.app.use(productionSecurity.ipBlocking());
    this.app.use(productionSecurity.suspiciousActivityDetection());

    // 7. Intrusion detection system
    if (this.options.enableIntrusionDetection) {
      this.app.use(this.productionSecurityHardening.intrusionDetectionSystem());
    }

    // 8. Rate limiting (general)
    if (this.options.enableRateLimiting) {
      this.app.use(productionSecurity.generalRateLimit());
      this.app.use(productionSecurity.slowDownMiddleware());
    }

    // 9. Comprehensive input validation and sanitization
    this.app.use(comprehensiveValidation);
    this.app.use(this.productionSecurityHardening.comprehensiveInputValidation());

    // 10. API key security validation
    if (this.options.enableApiKeyValidation) {
      this.app.use(this.productionSecurityHardening.apiKeySecurityValidation());
    }

    // 11. Security monitoring
    if (this.options.enableSecurityMonitoring) {
      this.app.use(this.productionSecurityHardening.securityMonitoringMiddleware());
    }

    // 12. Audit logging
    if (this.options.enableAuditLogging) {
      this.app.use(this.createAuditLoggingMiddleware());
    }

    // 13. Content validation (after parsing)
    this.app.use(validateContent);

    // 14. Custom security rules
    if (this.options.customSecurityRules) {
      this.options.customSecurityRules.forEach(rule => {
        this.app.use(rule);
      });
    }

    logger.info('Security middleware stack applied successfully');
  }

  /**
   * Apply route-specific security middleware
   */
  public applyRouteSpecificSecurity(): void {
    logger.info('Applying route-specific security middleware...');

    // Authentication routes - strict rate limiting
    this.app.use('/api/auth/*', authRateLimit);
    this.app.use('/api/auth/*', productionSecurity.authRateLimit());

    // Trading routes - trading-specific rate limiting and validation
    this.app.use('/api/trading/*', tradingRateLimit);
    this.app.use('/api/trading/*', productionSecurity.tradingRateLimit());
    this.app.use('/api/trading/*', this.createTradingSecurityMiddleware());

    // Admin routes - admin rate limiting and IP whitelist
    this.app.use('/api/admin/*', adminRateLimit);
    this.app.use('/api/admin/*', productionSecurity.adminRateLimit());
    this.app.use('/api/admin/*', this.createAdminSecurityMiddleware());

    // Password reset - specific rate limiting
    this.app.use('/api/auth/password-reset', productionSecurity.passwordResetRateLimit());

    // Registration - specific rate limiting
    this.app.use('/api/auth/register', productionSecurity.registrationRateLimit());

    // Export endpoints - export rate limiting
    this.app.use('/api/export/*', createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
      message: 'Too many export requests'
    }));

    logger.info('Route-specific security middleware applied successfully');
  }

  /**
   * Apply security error handling
   */
  public applySecurityErrorHandling(): void {
    // Security-specific error handler
    this.app.use((error: any, req: Request, res: Response, next: NextFunction) => {
      // Log security errors
      if (error.name === 'SecurityError' || error.code?.startsWith('SEC_')) {
        logger.error('Security error occurred:', {
          error: error.message,
          code: error.code,
          ip: this.getClientIP(req),
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent')
        });

        // Log to audit service
        this.auditService.logSecurityEvent(
          'SECURITY_ERROR' as any,
          (req as any).user?.userId,
          error.message,
          req,
          { errorCode: error.code, stack: error.stack }
        );

        return res.status(403).json({
          error: 'SECURITY_VIOLATION',
          message: 'Request blocked by security system',
          code: error.code
        });
      }

      next(error);
    });

    logger.info('Security error handling applied successfully');
  }

  /**
   * Get security metrics and status
   */
  public getSecurityStatus(): any {
    return {
      configuration: {
        environment: config.env,
        paperTradingMode: config.paperTradingMode,
        httpsEnforced: productionSecurityConfig.environment.enforceHTTPS,
        rateLimitingEnabled: productionSecurityConfig.rateLimiting.enabled,
        intrusionDetectionEnabled: productionSecurityConfig.intrusionDetection.enabled,
        auditLoggingEnabled: productionSecurityConfig.auditLogging.enabled
      },
      metrics: this.productionSecurityHardening.getSecurityMetrics(),
      services: {
        securityMonitoring: !!this.securityMonitoring,
        auditService: !!this.auditService,
        notificationService: !!this.notificationService
      }
    };
  }

  /**
   * Block IP address
   */
  public async blockIP(ip: string, reason: string, duration: number = 86400): Promise<void> {
    await this.productionSecurityHardening.blockIP(ip, reason, duration);
    await productionSecurity.blockIP(ip, duration, reason);
  }

  /**
   * Unblock IP address
   */
  public async unblockIP(ip: string): Promise<void> {
    await this.productionSecurityHardening.unblockIP(ip);
    await productionSecurity.unblockIP(ip);
  }

  /**
   * Get rate limit status for client
   */
  public async getRateLimitStatus(clientId: string, limiterType: string = 'api'): Promise<any> {
    return await productionSecurity.getRateLimitStatus(clientId, limiterType);
  }

  // Private helper methods
  private createAuditLoggingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const clientIP = this.getClientIP(req);
      const userId = (req as any).user?.userId;

      // Capture response for audit logging
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - startTime;
        
        // Log audit event
        if (userId) {
          // This would be implemented based on the specific audit requirements
          logger.info('API Request Audit', {
            userId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  private createTradingSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Ensure paper trading mode for all trading operations
      if (!config.paperTradingMode) {
        logger.error('CRITICAL: Trading operation attempted without paper trading mode', {
          ip: this.getClientIP(req),
          path: req.path,
          method: req.method
        });

        return res.status(403).json({
          error: 'TRADING_BLOCKED',
          message: 'Paper trading mode must be enabled'
        });
      }

      // Block real trading endpoints
      const realTradingPaths = ['/execute', '/place-order', '/withdraw', '/transfer'];
      if (realTradingPaths.some(path => req.path.includes(path))) {
        logger.error('CRITICAL: Real trading endpoint accessed', {
          ip: this.getClientIP(req),
          path: req.path
        });

        return res.status(403).json({
          error: 'REAL_TRADING_BLOCKED',
          message: 'Real trading operations are blocked'
        });
      }

      next();
    };
  }

  private createAdminSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIP = this.getClientIP(req);
      
      // IP whitelist for admin endpoints
      const adminWhitelist = productionSecurityConfig.ipManagement.whitelist;
      if (adminWhitelist.length > 0 && !adminWhitelist.includes(clientIP)) {
        logger.warn('Admin access denied - IP not whitelisted', {
          ip: clientIP,
          path: req.path
        });

        return res.status(403).json({
          error: 'ADMIN_ACCESS_DENIED',
          message: 'IP address not authorized for admin access'
        });
      }

      next();
    };
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }
}

/**
 * Factory function to create and configure security integration
 */
export function createSecurityIntegration(
  app: Express,
  prisma: PrismaClient,
  options?: SecurityIntegrationOptions
): SecurityIntegration {
  return new SecurityIntegration(app, prisma, options);
}

/**
 * Apply complete security stack to Express app
 */
export function applyProductionSecurity(
  app: Express,
  prisma: PrismaClient,
  options?: SecurityIntegrationOptions
): SecurityIntegration {
  const security = createSecurityIntegration(app, prisma, options);
  
  // Apply all security middleware
  security.applySecurityMiddleware();
  security.applyRouteSpecificSecurity();
  security.applySecurityErrorHandling();
  
  logger.info('Production security stack applied successfully');
  
  return security;
}

export default SecurityIntegration;