import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { logger, logPerformanceMetric } from '../utils/logger';
// Simple UUID v4 generator
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
      monitoring?: {
        startTime: number;
        requestId: string;
      };
    }
  }
}

export class MonitoringMiddleware {
  private monitoring: MonitoringService;
  private performance: PerformanceMonitoringService;

  constructor() {
    this.monitoring = MonitoringService.getInstance();
    this.performance = PerformanceMonitoringService.getInstance();
  }

  /**
   * Request tracking middleware
   * Adds request ID and start time to requests
   */
  public requestTracking = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = generateUUID();
    const startTime = Date.now();

    req.requestId = requestId;
    req.startTime = startTime;
    req.monitoring = {
      startTime,
      requestId
    };

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    // Increment active connections
    this.monitoring.incrementActiveConnections();

    // Log request start
    logger.info('Request started', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    next();
  };

  /**
   * Response monitoring middleware
   * Records metrics when response is finished
   */
  public responseMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Override response methods to capture metrics
    res.send = function(body) {
      recordResponseMetrics();
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      recordResponseMetrics();
      return originalJson.call(this, body);
    };

    res.end = function(chunk, encoding) {
      recordResponseMetrics();
      return originalEnd.call(this, chunk, encoding);
    };

    const recordResponseMetrics = () => {
      if (req.monitoring) {
        const duration = Date.now() - req.monitoring.startTime;
        const route = req.route?.path || req.path;
        const method = req.method;
        const statusCode = res.statusCode;

        // Record HTTP metrics
        this.monitoring.recordHttpRequest(method, route, statusCode, duration / 1000);

        // Record performance metrics
        this.performance.recordLatency('http_request', duration);
        this.performance.recordThroughput('http_requests');

        // Record errors if status code indicates error
        if (statusCode >= 400) {
          this.performance.recordError('http', `${statusCode}`);
          
          if (statusCode >= 500) {
            this.monitoring.recordError('http', 'server_error', 'high');
          } else if (statusCode >= 400) {
            this.monitoring.recordError('http', 'client_error', 'medium');
          }
        }

        // Decrement active connections
        this.monitoring.decrementActiveConnections();

        // Log response
        logger.info('Request completed', {
          requestId: req.monitoring.requestId,
          method,
          url: req.url,
          statusCode,
          duration,
          contentLength: res.get('Content-Length'),
          timestamp: new Date().toISOString()
        });

        // Log performance metric
        logPerformanceMetric('http_request_duration', duration, {
          method,
          route,
          statusCode,
          requestId: req.monitoring.requestId
        });
      }
    };

    next();
  };

  /**
   * Error monitoring middleware
   * Records error metrics and logs
   */
  public errorMonitoring = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.requestId || 'unknown';
    
    // Record error metrics
    this.monitoring.recordError('application', error.name || 'UnknownError', 'high');
    this.performance.recordError('application', error.name || 'UnknownError');

    // Log error with context
    logger.error('Request error', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    next(error);
  };

  /**
   * Security event monitoring middleware
   * Records security-related events
   */
  public securityMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    // Monitor for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//,  // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript injection
      /vbscript:/i, // VBScript injection
    ];

    const url = req.url;
    const body = JSON.stringify(req.body || {});
    const query = JSON.stringify(req.query || {});

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body) || pattern.test(query)) {
        this.monitoring.recordSecurityEvent('suspicious_request', 'medium', req.ip || 'unknown');
        
        logger.warn('Suspicious request detected', {
          requestId: req.requestId,
          pattern: pattern.source,
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        break;
      }
    }

    // Monitor for rate limiting violations
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      this.monitoring.recordSecurityEvent('bot_request', 'low', req.ip || 'unknown');
    }

    next();
  };

  /**
   * Paper trading monitoring middleware
   * Records paper trading specific metrics
   */
  public paperTradingMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    // Monitor trading-related endpoints
    if (req.path.includes('/trading') || req.path.includes('/orders')) {
      const originalJson = res.json;
      
      res.json = function(body) {
        // Record paper trading metrics if this is a trading operation
        if (body && body.type === 'paper_trade') {
          const monitoring = MonitoringService.getInstance();
          monitoring.recordPaperTrade(
            body.symbol || 'unknown',
            body.side || 'unknown',
            body.exchange || 'unknown'
          );
        }
        
        return originalJson.call(this, body);
      };
    }

    next();
  };
}

// Create singleton instance
const monitoringMiddleware = new MonitoringMiddleware();

// Export middleware functions
export const requestTracking = monitoringMiddleware.requestTracking;
export const responseMonitoring = monitoringMiddleware.responseMonitoring;
export const errorMonitoring = monitoringMiddleware.errorMonitoring;
export const securityMonitoring = monitoringMiddleware.securityMonitoring;
export const paperTradingMonitoring = monitoringMiddleware.paperTradingMonitoring;

// Combined monitoring middleware
export const fullMonitoring = [
  requestTracking,
  responseMonitoring,
  securityMonitoring,
  paperTradingMonitoring
];

export default monitoringMiddleware;