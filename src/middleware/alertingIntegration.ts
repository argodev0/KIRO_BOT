import { Request, Response, NextFunction } from 'express';
import { ProductionAlertingService } from '../services/ProductionAlertingService';
import { logger } from '../utils/logger';

interface AlertingMiddlewareOptions {
  enablePerformanceMonitoring?: boolean;
  enableErrorTracking?: boolean;
  enableSecurityMonitoring?: boolean;
  performanceThresholds?: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export class AlertingIntegrationMiddleware {
  private alertingService: ProductionAlertingService;
  private options: AlertingMiddlewareOptions;
  private requestStartTimes: Map<string, number> = new Map();

  constructor(options: AlertingMiddlewareOptions = {}) {
    this.alertingService = ProductionAlertingService.getInstance();
    this.options = {
      enablePerformanceMonitoring: true,
      enableErrorTracking: true,
      enableSecurityMonitoring: true,
      performanceThresholds: {
        responseTime: 2000, // 2 seconds
        memoryUsage: 85, // 85%
        cpuUsage: 80 // 80%
      },
      ...options
    };
  }

  // Request monitoring middleware
  public requestMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.options.enablePerformanceMonitoring) {
      return next();
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    // Store start time for this request
    this.requestStartTimes.set(requestId, startTime);
    
    // Add request ID to request object for tracking
    (req as any).requestId = requestId;

    // Monitor response
    const originalSend = res.send;
    res.send = function(data) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Update performance metrics
      this.updateResponseTimeMetric(responseTime, req.method, req.route?.path || req.path);
      
      // Check for slow responses
      if (responseTime > this.options.performanceThresholds!.responseTime) {
        this.alertingService.detectCriticalIssue(
          'performance_degradation',
          'Slow API Response',
          `API response time exceeded threshold: ${responseTime}ms for ${req.method} ${req.path}`,
          'performance_monitor',
          {
            method: req.method,
            path: req.path,
            responseTime,
            threshold: this.options.performanceThresholds!.responseTime,
            statusCode: res.statusCode
          },
          responseTime > this.options.performanceThresholds!.responseTime * 2 ? 'critical' : 'warning'
        );
      }

      // Clean up
      this.requestStartTimes.delete(requestId);
      
      return originalSend.call(this, data);
    }.bind(this);

    next();
  };

  // Error tracking middleware
  public errorTracking = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    if (!this.options.enableErrorTracking) {
      return next(error);
    }

    // Determine error severity
    const severity = this.determineErrorSeverity(error, res.statusCode);
    
    // Create critical issue for significant errors
    if (severity !== 'info') {
      this.alertingService.detectCriticalIssue(
        'system_failure',
        `API Error: ${error.name}`,
        `Error occurred in ${req.method} ${req.path}: ${error.message}`,
        'error_tracker',
        {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          requestId: (req as any).requestId
        },
        severity
      );
    }

    next(error);
  };

  // Security monitoring middleware
  public securityMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.options.enableSecurityMonitoring) {
      return next();
    }

    // Monitor for suspicious activity
    this.checkSuspiciousActivity(req);
    
    // Monitor authentication failures
    if (req.path.includes('/auth') && res.statusCode === 401) {
      this.alertingService.updatePerformanceMetric('failed_authentication_rate', 1);
    }

    // Monitor rate limit violations
    if (res.statusCode === 429) {
      this.alertingService.updatePerformanceMetric('rate_limit_violations_rate', 1);
    }

    next();
  };

  // Paper trading safety monitoring middleware
  public paperTradingSafetyMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    // Check if this is a trading-related endpoint
    if (this.isTradingEndpoint(req.path)) {
      // Verify paper trading mode is enabled
      if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
        this.alertingService.detectCriticalIssue(
          'paper_trading_violation',
          'Trading Endpoint Access with Paper Trading Disabled',
          `Access to trading endpoint ${req.path} while paper trading mode is disabled`,
          'paper_trading_guard',
          {
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            tradingSimulationOnly: process.env.TRADING_SIMULATION_ONLY
          },
          'emergency'
        );
        
        // Block the request
        res.status(403).json({
          success: false,
          error: 'Trading operations are blocked - paper trading mode is not enabled'
        });
        return;
      }

      // Log paper trading activity
      logger.info('Paper trading endpoint accessed', {
        endpoint: req.path,
        method: req.method,
        ip: req.ip
      });
    }

    next();
  };

  // System health monitoring
  public systemHealthMonitoring = (): void => {
    setInterval(() => {
      this.checkSystemHealth();
    }, 30000); // Check every 30 seconds
  };

  // Database monitoring middleware
  public databaseMonitoring = (req: Request, res: Response, next: NextFunction): void => {
    // This would be integrated with database query monitoring
    // For now, we'll just pass through
    next();
  };

  // WebSocket monitoring
  public webSocketMonitoring = (ws: any, req: Request): void => {
    const connectionStart = Date.now();
    
    ws.on('close', () => {
      const connectionDuration = Date.now() - connectionStart;
      this.alertingService.updatePerformanceMetric('websocket_connection_duration', connectionDuration);
    });

    ws.on('error', (error: Error) => {
      this.alertingService.detectCriticalIssue(
        'system_failure',
        'WebSocket Error',
        `WebSocket error: ${error.message}`,
        'websocket_monitor',
        {
          error: error.message,
          stack: error.stack,
          ip: req.ip
        },
        'warning'
      );
    });
  };

  // Helper methods
  private updateResponseTimeMetric(responseTime: number, method: string, path: string): void {
    this.alertingService.updatePerformanceMetric('api_response_time', responseTime);
    this.alertingService.updatePerformanceMetric(`api_response_time_${method.toLowerCase()}`, responseTime);
  }

  private determineErrorSeverity(error: Error, statusCode: number): 'warning' | 'critical' | 'emergency' {
    // 5xx errors are more serious
    if (statusCode >= 500) {
      return statusCode >= 503 ? 'critical' : 'warning';
    }

    // Specific error types
    if (error.name === 'ValidationError') return 'warning';
    if (error.name === 'DatabaseError') return 'critical';
    if (error.name === 'SecurityError') return 'emergency';
    
    return 'warning';
  }

  private checkSuspiciousActivity(req: Request): void {
    // Check for SQL injection attempts
    const suspiciousPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /<script/i,
      /javascript:/i
    ];

    const queryString = JSON.stringify(req.query);
    const bodyString = JSON.stringify(req.body);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(queryString) || pattern.test(bodyString)) {
        this.alertingService.detectCriticalIssue(
          'security_breach',
          'Suspicious Request Pattern Detected',
          `Potentially malicious request pattern detected in ${req.method} ${req.path}`,
          'security_monitor',
          {
            pattern: pattern.toString(),
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          },
          'critical'
        );
        break;
      }
    }
  }

  private isTradingEndpoint(path: string): boolean {
    const tradingPaths = [
      '/api/trading',
      '/api/orders',
      '/api/positions',
      '/api/trades',
      '/api/execute'
    ];
    
    return tradingPaths.some(tradingPath => path.startsWith(tradingPath));
  }

  private checkSystemHealth(): void {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      this.alertingService.updatePerformanceMetric('system_memory_usage_percent', memUsagePercent);

      // Check if memory usage is too high
      if (memUsagePercent > this.options.performanceThresholds!.memoryUsage) {
        this.alertingService.detectCriticalIssue(
          'performance_degradation',
          'High Memory Usage',
          `System memory usage is ${memUsagePercent.toFixed(2)}%, exceeding threshold of ${this.options.performanceThresholds!.memoryUsage}%`,
          'system_monitor',
          {
            memoryUsage: memUsagePercent,
            threshold: this.options.performanceThresholds!.memoryUsage,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal
          },
          memUsagePercent > 95 ? 'critical' : 'warning'
        );
      }

      // Check event loop lag (simplified)
      const start = process.hrtime();
      setImmediate(() => {
        const delta = process.hrtime(start);
        const lag = (delta[0] * 1000) + (delta[1] * 1e-6);
        this.alertingService.updatePerformanceMetric('event_loop_lag', lag);
        
        if (lag > 100) { // 100ms lag threshold
          this.alertingService.detectCriticalIssue(
            'performance_degradation',
            'High Event Loop Lag',
            `Event loop lag is ${lag.toFixed(2)}ms, indicating potential performance issues`,
            'system_monitor',
            {
              eventLoopLag: lag,
              threshold: 100
            },
            lag > 500 ? 'critical' : 'warning'
          );
        }
      });

    } catch (error) {
      logger.error('System health check failed:', error);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for manual monitoring
  public reportCustomMetric(name: string, value: number, threshold?: number): void {
    this.alertingService.updatePerformanceMetric(name, value, threshold);
  }

  public reportCustomIssue(
    type: 'system_failure' | 'paper_trading_violation' | 'performance_degradation' | 'security_breach',
    title: string,
    description: string,
    metadata: Record<string, any> = {},
    severity: 'warning' | 'critical' | 'emergency' = 'warning'
  ): string {
    return this.alertingService.detectCriticalIssue(type, title, description, 'custom_reporter', metadata, severity);
  }
}

// Export singleton instance
export const alertingIntegration = new AlertingIntegrationMiddleware();

// Export individual middleware functions
export const requestMonitoring = alertingIntegration.requestMonitoring;
export const errorTracking = alertingIntegration.errorTracking;
export const securityMonitoring = alertingIntegration.securityMonitoring;
export const paperTradingSafetyMonitoring = alertingIntegration.paperTradingSafetyMonitoring;
export const databaseMonitoring = alertingIntegration.databaseMonitoring;