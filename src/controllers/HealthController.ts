import { Request, Response } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { logger, logPerformanceMetric } from '../utils/logger';
import { config } from '../config/config';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

export class HealthController {
  private monitoring: MonitoringService;
  private performance: PerformanceMonitoringService;

  constructor() {
    this.monitoring = MonitoringService.getInstance();
    this.performance = PerformanceMonitoringService.getInstance();
  }

  /**
   * Basic health check endpoint
   * Returns simple status for load balancers
   */
  public basicHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const systemHealth = this.monitoring.getSystemHealth();
      
      if (systemHealth.status === 'healthy') {
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: systemHealth.status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Basic health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Detailed health check endpoint
   * Returns comprehensive system health information
   */
  public detailedHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const systemHealth = this.monitoring.getSystemHealth();
      const serviceStatuses = this.monitoring.getServiceStatuses();
      const performanceMetrics = this.performance.getPerformanceMetrics();
      
      const healthData = {
        status: systemHealth.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.env,
        
        // Paper trading safety status
        paperTrading: {
          enabled: config.paperTrading?.enabled || false,
          allowRealTrades: config.paperTrading?.allowRealTrades || false,
          safetyMode: !(config.paperTrading?.allowRealTrades || false)
        },
        
        // System checks
        checks: systemHealth.checks,
        
        // Service statuses
        services: serviceStatuses.reduce((acc, service) => {
          acc[service.name] = {
            status: service.status,
            lastCheck: new Date(service.lastCheck).toISOString(),
            responseTime: service.responseTime,
            error: service.error
          };
          return acc;
        }, {} as any),
        
        // System metrics
        system: {
          memory: {
            used: systemHealth.metrics.memory.heapUsed,
            total: systemHealth.metrics.memory.heapTotal,
            external: systemHealth.metrics.memory.external,
            rss: systemHealth.metrics.memory.rss,
            systemFree: systemHealth.metrics.freeMemory,
            systemTotal: systemHealth.metrics.totalMemory,
            usage: ((systemHealth.metrics.totalMemory - systemHealth.metrics.freeMemory) / systemHealth.metrics.totalMemory * 100).toFixed(2) + '%'
          },
          cpu: {
            usage: systemHealth.metrics.cpu,
            loadAverage: systemHealth.metrics.loadAverage,
            cores: os.cpus().length
          },
          platform: {
            type: os.type(),
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname()
          }
        },
        
        // Performance metrics
        performance: {
          latency: performanceMetrics.latency,
          throughput: performanceMetrics.throughput,
          errorRate: {
            overall: performanceMetrics.errorRate.overall,
            byService: Object.fromEntries(performanceMetrics.errorRate.byService),
            byExchange: Object.fromEntries(performanceMetrics.errorRate.byExchange)
          }
        },
        
        // Response time for this health check
        responseTime: Date.now() - startTime
      };

      // Log performance metric
      logPerformanceMetric('health_check_duration', Date.now() - startTime, {
        endpoint: 'detailed_health'
      });

      const statusCode = systemHealth.status === 'healthy' ? 200 : 
                        systemHealth.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(healthData);
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Readiness probe endpoint
   * Checks if the application is ready to serve traffic
   */
  public readiness = async (req: Request, res: Response): Promise<void> => {
    try {
      const systemHealth = this.monitoring.getSystemHealth();
      const criticalServices = ['database', 'redis'];
      
      const criticalServicesHealthy = criticalServices.every(service => 
        systemHealth.checks[service as keyof typeof systemHealth.checks]
      );

      if (criticalServicesHealthy && systemHealth.status !== 'unhealthy') {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          criticalServices: criticalServices.reduce((acc, service) => {
            acc[service] = systemHealth.checks[service as keyof typeof systemHealth.checks];
            return acc;
          }, {} as any)
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          criticalServices: criticalServices.reduce((acc, service) => {
            acc[service] = systemHealth.checks[service as keyof typeof systemHealth.checks];
            return acc;
          }, {} as any)
        });
      }
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'not_ready',
        error: 'Readiness check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Liveness probe endpoint
   * Checks if the application is alive and should not be restarted
   */
  public liveness = async (req: Request, res: Response): Promise<void> => {
    try {
      // Basic liveness check - if we can respond, we're alive
      const memUsage = process.memoryUsage();
      const isAlive = memUsage.heapUsed < (memUsage.heapTotal * 0.95); // Not using more than 95% of heap
      
      if (isAlive) {
        res.status(200).json({
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memoryUsage: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%'
          }
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          reason: 'High memory usage',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Liveness check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Liveness check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Startup probe endpoint
   * Checks if the application has started successfully
   */
  public startup = async (req: Request, res: Response): Promise<void> => {
    try {
      const uptime = process.uptime();
      const isStarted = uptime > 10; // Consider started after 10 seconds
      
      if (isStarted) {
        res.status(200).json({
          status: 'started',
          timestamp: new Date().toISOString(),
          uptime: uptime,
          startTime: new Date(Date.now() - (uptime * 1000)).toISOString()
        });
      } else {
        res.status(503).json({
          status: 'starting',
          timestamp: new Date().toISOString(),
          uptime: uptime
        });
      }
    } catch (error) {
      logger.error('Startup check failed:', error);
      res.status(503).json({
        status: 'failed',
        error: 'Startup check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Deep health check endpoint
   * Performs comprehensive system validation
   */
  public deepHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const checks = await this.performDeepHealthChecks();
      
      const allPassed = Object.values(checks).every(check => check.status === 'pass');
      const statusCode = allPassed ? 200 : 503;
      
      res.status(statusCode).json({
        status: allPassed ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: checks,
        duration: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Deep health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Deep health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  private async performDeepHealthChecks(): Promise<any> {
    const checks: any = {};

    // File system check
    try {
      const testFile = '/tmp/kiro_bot_deep_health_check';
      await promisify(fs.writeFile)(testFile, 'deep health check');
      const content = await promisify(fs.readFile)(testFile, 'utf8');
      await promisify(fs.unlink)(testFile);
      
      checks.filesystem = {
        status: content === 'deep health check' ? 'pass' : 'fail',
        message: 'File system read/write operations'
      };
    } catch (error) {
      checks.filesystem = {
        status: 'fail',
        message: 'File system operations failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Memory pressure check
    const memUsage = process.memoryUsage();
    const memoryPressure = (memUsage.heapUsed / memUsage.heapTotal) > 0.8;
    checks.memory_pressure = {
      status: memoryPressure ? 'warn' : 'pass',
      message: `Memory usage: ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}%`,
      usage: memUsage
    };

    // Event loop lag check
    const eventLoopStart = process.hrtime.bigint();
    await new Promise(resolve => setImmediate(resolve));
    const eventLoopLag = Number(process.hrtime.bigint() - eventLoopStart) / 1000000; // Convert to ms
    
    checks.event_loop = {
      status: eventLoopLag > 100 ? 'warn' : 'pass',
      message: `Event loop lag: ${eventLoopLag.toFixed(2)}ms`,
      lag: eventLoopLag
    };

    // Paper trading safety check
    checks.paper_trading_safety = {
      status: (config.paperTrading?.enabled && !config.paperTrading?.allowRealTrades) ? 'pass' : 'fail',
      message: 'Paper trading safety validation',
      enabled: config.paperTrading?.enabled || false,
      allowRealTrades: config.paperTrading?.allowRealTrades || false
    };

    return checks;
  }
}