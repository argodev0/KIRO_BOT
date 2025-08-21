/**
 * Production Logging Service
 * Comprehensive logging system for production environment
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { Request, Response } from 'express';
import crypto from 'crypto';

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  tradeId?: string;
  signalId?: string;
  exchange?: string;
  symbol?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'data_access' | 'configuration_change' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
}

interface AuditEvent {
  eventType: string;
  userId: string;
  resource: string;
  action: string;
  outcome: 'success' | 'failure';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
}

interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  errorType?: string;
  metadata?: Record<string, any>;
}

export class ProductionLoggingService {
  private logger: winston.Logger;
  private auditLogger: winston.Logger;
  private securityLogger: winston.Logger;
  private performanceLogger: winston.Logger;
  private errorLogger: winston.Logger;

  constructor() {
    this.initializeLoggers();
  }

  private initializeLoggers(): void {
    // Main application logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            service: 'trading-bot',
            environment: process.env.NODE_ENV,
            version: process.env.APP_VERSION,
            ...meta
          });
        })
      ),
      defaultMeta: {
        service: 'trading-bot',
        environment: process.env.NODE_ENV,
        hostname: process.env.HOSTNAME || 'unknown'
      },
      transports: [
        // Console output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),

        // Daily rotating file for all logs
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '30d',
          zippedArchive: true
        }),

        // Separate file for errors
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10
        })
      ]
    });

    // Audit logger for compliance and security
    this.auditLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/audit-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '365d', // Keep audit logs for 1 year
          zippedArchive: true
        })
      ]
    });

    // Security logger for security events
    this.securityLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '365d',
          zippedArchive: true
        }),
        // Also send to console for immediate attention
        new winston.transports.Console({
          level: 'warn',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Performance logger for metrics
    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/performance-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '30d',
          zippedArchive: true
        })
      ]
    });

    // Error logger with detailed stack traces
    this.errorLogger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/errors-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '90d',
          zippedArchive: true
        })
      ]
    });

    // Add Elasticsearch transport for production
    if (process.env.ELASTICSEARCH_URL && process.env.NODE_ENV === 'production') {
      const esTransport = new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_URL,
          auth: {
            username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
            password: process.env.ELASTICSEARCH_PASSWORD || ''
          }
        },
        index: 'trading-bot-logs'
      });

      this.logger.add(esTransport);
      this.auditLogger.add(esTransport);
      this.securityLogger.add(esTransport);
    }
  }

  /**
   * Log general application events
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.sanitizeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.sanitizeContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logData = {
      ...this.sanitizeContext(context),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.logger.error(message, logData);
    this.errorLogger.error(message, logData);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.sanitizeContext(context));
  }

  /**
   * Log trading-specific events
   */
  logTradingEvent(event: string, data: any, context?: LogContext): void {
    this.info(`Trading Event: ${event}`, {
      ...context,
      eventType: 'trading',
      eventData: this.sanitizeTradingData(data)
    });
  }

  logSignalGeneration(signalId: string, signal: any, context?: LogContext): void {
    this.info('Signal Generated', {
      ...context,
      signalId,
      eventType: 'signal_generation',
      signal: this.sanitizeSignalData(signal)
    });
  }

  logTradeExecution(tradeId: string, trade: any, context?: LogContext): void {
    this.info('Trade Executed', {
      ...context,
      tradeId,
      eventType: 'trade_execution',
      trade: this.sanitizeTradeData(trade)
    });
  }

  logRiskEvent(event: string, data: any, context?: LogContext): void {
    this.warn(`Risk Event: ${event}`, {
      ...context,
      eventType: 'risk_management',
      riskData: data
    });
  }

  /**
   * Log audit events for compliance
   */
  logAuditEvent(event: AuditEvent): void {
    const auditData = {
      ...event,
      auditId: this.generateAuditId(),
      timestamp: new Date().toISOString()
    };

    this.auditLogger.info('Audit Event', auditData);
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: SecurityEvent): void {
    const securityData = {
      ...event,
      securityId: this.generateSecurityId(),
      timestamp: new Date().toISOString()
    };

    this.securityLogger.warn('Security Event', securityData);

    // Alert on critical security events
    if (event.severity === 'critical') {
      this.alertCriticalSecurity(securityData);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceLogger.info('Performance Metrics', {
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log API requests and responses
   */
  logAPIRequest(req: Request, res: Response, duration: number): void {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ipAddress: this.getClientIP(req),
      userId: (req as any).user?.id,
      requestId: (req as any).requestId
    };

    if (res.statusCode >= 400) {
      this.warn('API Request Failed', logData);
    } else {
      this.info('API Request', logData);
    }
  }

  /**
   * Log database operations
   */
  logDatabaseOperation(operation: string, table: string, duration: number, success: boolean, error?: Error): void {
    const logData = {
      operation,
      table,
      duration,
      success,
      error: error ? {
        name: error.name,
        message: error.message
      } : undefined
    };

    if (success) {
      this.debug('Database Operation', logData);
    } else {
      this.error('Database Operation Failed', error, logData);
    }
  }

  /**
   * Log exchange API calls
   */
  logExchangeAPI(exchange: string, endpoint: string, method: string, duration: number, success: boolean, error?: Error): void {
    const logData = {
      exchange,
      endpoint,
      method,
      duration,
      success,
      eventType: 'exchange_api'
    };

    if (success) {
      this.debug('Exchange API Call', logData);
    } else {
      this.error('Exchange API Call Failed', error, logData);
    }
  }

  /**
   * Create request logger middleware
   */
  createRequestLogger() {
    return (req: Request, res: Response, next: Function) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      
      // Add request ID to request object
      (req as any).requestId = requestId;

      // Log request start
      this.debug('Request Started', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ipAddress: this.getClientIP(req)
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk: any, encoding?: any) {
        const duration = Date.now() - startTime;
        
        // Log the request completion
        const loggingService = new ProductionLoggingService();
        loggingService.logAPIRequest(req, res, duration);

        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };

    // Remove or mask sensitive fields
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeMetadata(sanitized.metadata);
    }

    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    const sensitiveFields = ['password', 'secret', 'key', 'token', 'apiKey', 'privateKey'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.maskSensitiveData(sanitized[field]);
      }
    }

    return sanitized;
  }

  private sanitizeTradingData(data: any): any {
    const sanitized = { ...data };
    
    // Remove sensitive trading data
    delete sanitized.apiKey;
    delete sanitized.secretKey;
    delete sanitized.privateKey;

    return sanitized;
  }

  private sanitizeSignalData(signal: any): any {
    const sanitized = { ...signal };
    
    // Keep only necessary signal information
    return {
      id: sanitized.id,
      symbol: sanitized.symbol,
      direction: sanitized.direction,
      confidence: sanitized.confidence,
      timestamp: sanitized.timestamp
    };
  }

  private sanitizeTradeData(trade: any): any {
    const sanitized = { ...trade };
    
    // Remove sensitive trade data
    delete sanitized.apiCredentials;
    
    return sanitized;
  }

  private maskSensitiveData(value: string): string {
    if (typeof value !== 'string' || value.length < 4) {
      return '***';
    }
    
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  private generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateSecurityId(): string {
    return `security_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string) ||
           (req.headers['x-real-ip'] as string) ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private async alertCriticalSecurity(event: any): Promise<void> {
    // Implementation would send alerts via email, Slack, SMS, etc.
    // This is a placeholder for the actual alerting mechanism
    console.error('CRITICAL SECURITY EVENT:', event);
    
    // In production, this would integrate with:
    // - Email service
    // - Slack webhooks
    // - SMS service
    // - PagerDuty or similar
  }

  /**
   * Graceful shutdown - flush all logs
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      let pendingFlushes = 0;
      const loggers = [this.logger, this.auditLogger, this.securityLogger, this.performanceLogger, this.errorLogger];

      const checkComplete = () => {
        pendingFlushes--;
        if (pendingFlushes === 0) {
          resolve();
        }
      };

      loggers.forEach(logger => {
        pendingFlushes++;
        logger.end(checkComplete);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        resolve();
      }, 5000);
    });
  }
}

// Singleton instance
export const productionLogger = new ProductionLoggingService();