import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { logger } from '../utils/logger';

interface MonitoredRequest extends Request {
  startTime?: number;
  requestId?: string;
}

export class MonitoringMiddleware {
  private monitoring: MonitoringService;
  private performance: PerformanceMonitoringService;

  constructor() {
    this.monitoring = MonitoringService.getInstance();
    this.performance = PerformanceMonitoringService.getInstance();
  }

  // Request monitoring middleware
  public requestMonitoring() {
    return (req: MonitoredRequest, res: Response, next: NextFunction) => {
      req.startTime = Date.now();
      req.requestId = this.generateRequestId();

      // Increment active connections
      this.monitoring.incrementActiveConnections();

      // Record throughput
      this.performance.recordThroughput('http_requests');

      // Log request
      logger.info(`Request started: ${req.method} ${req.path}`, {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Monitor response
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - (req.startTime || 0);
        
        // Record metrics
        this.monitoring.recordHttpRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration / 1000
        );

        this.performance.recordLatency('http_request', duration);

        // Decrement active connections
        this.monitoring.decrementActiveConnections();

        // Log response
        logger.info(`Request completed: ${req.method} ${req.path}`, {
          requestId: req.requestId,
          statusCode: res.statusCode,
          duration,
          responseSize: data ? data.length : 0
        });

        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  // Error monitoring middleware
  public errorMonitoring() {
    return (error: Error, req: MonitoredRequest, res: Response, next: NextFunction) => {
      const duration = Date.now() - (req.startTime || 0);

      // Record error metrics
      this.monitoring.recordError('api', error.name, 'high');
      this.performance.recordError('api', error.name);

      // Log error
      logger.error(`Request error: ${req.method} ${req.path}`, {
        requestId: req.requestId,
        error: error.message,
        stack: error.stack,
        duration
      });

      next(error);
    };
  }

  // Trading operation monitoring
  public tradingMonitoring() {
    return (req: MonitoredRequest, res: Response, next: NextFunction) => {
      if (req.path.includes('/trading/') || req.path.includes('/signals/')) {
        const originalSend = res.send;
        res.send = function(data) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Record successful trading operation
            this.performance.recordThroughput('trading_operations');
          } else {
            // Record trading error
            this.performance.recordError('trading', 'operation_failed');
          }

          return originalSend.call(this, data);
        }.bind(this);
      }

      next();
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export middleware functions
const monitoringMiddleware = new MonitoringMiddleware();

export const requestMonitoring = monitoringMiddleware.requestMonitoring.bind(monitoringMiddleware);
export const errorMonitoring = monitoringMiddleware.errorMonitoring.bind(monitoringMiddleware);
export const tradingMonitoring = monitoringMiddleware.tradingMonitoring.bind(monitoringMiddleware);