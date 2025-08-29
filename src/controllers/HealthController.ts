import { Request, Response } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { PerformanceMonitoringService } from '../services/PerformanceMonitoringService';
import { SystemHealthService } from '../services/SystemHealthService';
import { logger, logPerformanceMetric } from '../utils/logger';
import { config } from '../config/config';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

export class HealthController {
  private monitoring: MonitoringService;
  private performance: PerformanceMonitoringService;
  private systemHealthService: SystemHealthService;

  constructor() {
    this.monitoring = MonitoringService.getInstance();
    this.performance = PerformanceMonitoringService.getInstance();
    this.systemHealthService = SystemHealthService.getInstance();
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

  /**
   * Comprehensive system health endpoint
   * Returns detailed health information for all services
   */
  public systemHealth = async (_req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const healthReport = await this.systemHealthService.getSystemHealth();
      
      // Log performance metric
      logPerformanceMetric('system_health_check_duration', Date.now() - startTime, {
        endpoint: 'system_health',
        overall_status: healthReport.overall
      });

      const statusCode = healthReport.overall === 'healthy' ? 200 : 
                        healthReport.overall === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(healthReport);
    } catch (error) {
      logger.error('System health check failed:', error);
      res.status(503).json({
        overall: 'unhealthy',
        error: 'System health check failed',
        timestamp: new Date().toISOString(),
        services: {},
        metrics: {}
      });
    }
  };

  /**
   * All services health check endpoint
   * Returns health status for all monitored services
   */
  public allServicesHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const healthReport = await this.systemHealthService.getSystemHealth();
      
      // Extract service statuses
      const services = {
        database: healthReport.services.database,
        redis: healthReport.services.redis,
        exchanges: healthReport.services.exchanges,
        websocket: healthReport.services.websocket,
        filesystem: healthReport.services.filesystem,
        memory: healthReport.services.memory,
        cpu: healthReport.services.cpu,
        paperTradingSafety: healthReport.services.paperTradingSafety
      };

      // Calculate overall service health
      const serviceStatuses = Object.values(services).map(s => s.status);
      const hasUnhealthy = serviceStatuses.includes('unhealthy');
      const hasDegraded = serviceStatuses.includes('degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (hasUnhealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }

      const responseTime = Date.now() - startTime;
      
      // Log performance metric
      logPerformanceMetric('all_services_health_check_duration', responseTime, {
        endpoint: 'all_services_health',
        overall_status: overallStatus,
        service_count: Object.keys(services).length
      });

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        overall: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime,
        services,
        summary: {
          total: Object.keys(services).length,
          healthy: serviceStatuses.filter(s => s === 'healthy').length,
          degraded: serviceStatuses.filter(s => s === 'degraded').length,
          unhealthy: serviceStatuses.filter(s => s === 'unhealthy').length
        }
      });
    } catch (error) {
      logger.error('All services health check failed:', error);
      res.status(503).json({
        overall: 'unhealthy',
        error: 'All services health check failed',
        timestamp: new Date().toISOString(),
        services: {},
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 }
      });
    }
  };

  /**
   * Infrastructure health check endpoint
   * Checks core infrastructure components
   */
  public infrastructureHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      
      // Check core infrastructure components
      const [databaseResult, redisResult, filesystemResult] = await Promise.allSettled([
        this.systemHealthService.checkDatabaseHealth(),
        this.systemHealthService.checkRedisHealth(),
        this.systemHealthService.checkFilesystemHealth()
      ]);

      const infrastructure = {
        database: this.extractHealthResult(databaseResult, 'database'),
        redis: this.extractHealthResult(redisResult, 'redis'),
        filesystem: this.extractHealthResult(filesystemResult, 'filesystem')
      };

      // Determine overall infrastructure health
      const infraStatuses = Object.values(infrastructure).map(s => s.status);
      const hasUnhealthy = infraStatuses.includes('unhealthy');
      const hasDegraded = infraStatuses.includes('degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (hasUnhealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }

      const responseTime = Date.now() - startTime;
      
      // Log performance metric
      logPerformanceMetric('infrastructure_health_check_duration', responseTime, {
        endpoint: 'infrastructure_health',
        overall_status: overallStatus
      });

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        overall: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime,
        infrastructure,
        summary: {
          total: Object.keys(infrastructure).length,
          healthy: infraStatuses.filter(s => s === 'healthy').length,
          degraded: infraStatuses.filter(s => s === 'degraded').length,
          unhealthy: infraStatuses.filter(s => s === 'unhealthy').length
        }
      });
    } catch (error) {
      logger.error('Infrastructure health check failed:', error);
      res.status(503).json({
        overall: 'unhealthy',
        error: 'Infrastructure health check failed',
        timestamp: new Date().toISOString(),
        infrastructure: {},
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 }
      });
    }
  };

  /**
   * External services health check endpoint
   * Checks external service connectivity (exchanges, APIs)
   */
  public externalServicesHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      
      // Check external services
      const exchangesResult = await this.systemHealthService.checkExchangesHealth();

      const externalServices = {
        exchanges: exchangesResult,
        // Add other external services as needed
      };

      // Determine overall external services health
      const extStatuses = Object.values(externalServices).map(s => s.status);
      const hasUnhealthy = extStatuses.includes('unhealthy');
      const hasDegraded = extStatuses.includes('degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (hasUnhealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }

      const responseTime = Date.now() - startTime;
      
      // Log performance metric
      logPerformanceMetric('external_services_health_check_duration', responseTime, {
        endpoint: 'external_services_health',
        overall_status: overallStatus
      });

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        overall: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime,
        externalServices,
        summary: {
          total: Object.keys(externalServices).length,
          healthy: extStatuses.filter(s => s === 'healthy').length,
          degraded: extStatuses.filter(s => s === 'degraded').length,
          unhealthy: extStatuses.filter(s => s === 'unhealthy').length
        }
      });
    } catch (error) {
      logger.error('External services health check failed:', error);
      res.status(503).json({
        overall: 'unhealthy',
        error: 'External services health check failed',
        timestamp: new Date().toISOString(),
        externalServices: {},
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 }
      });
    }
  };

  /**
   * Application health check endpoint
   * Checks application-specific health metrics
   */
  public applicationHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      
      // Check application-specific components
      const [memoryResult, cpuResult, paperTradingResult, websocketResult] = await Promise.allSettled([
        this.systemHealthService.checkMemoryHealth(),
        this.systemHealthService.checkCpuHealth(),
        this.systemHealthService.checkPaperTradingSafety(),
        this.systemHealthService.checkWebSocketHealth()
      ]);

      const application = {
        memory: this.extractHealthResult(memoryResult, 'memory'),
        cpu: this.extractHealthResult(cpuResult, 'cpu'),
        paperTradingSafety: this.extractHealthResult(paperTradingResult, 'paperTradingSafety'),
        websocket: this.extractHealthResult(websocketResult, 'websocket')
      };

      // Determine overall application health
      const appStatuses = Object.values(application).map(s => s.status);
      const hasUnhealthy = appStatuses.includes('unhealthy');
      const hasDegraded = appStatuses.includes('degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (hasUnhealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }

      const responseTime = Date.now() - startTime;
      
      // Log performance metric
      logPerformanceMetric('application_health_check_duration', responseTime, {
        endpoint: 'application_health',
        overall_status: overallStatus
      });

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        overall: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime,
        application,
        summary: {
          total: Object.keys(application).length,
          healthy: appStatuses.filter(s => s === 'healthy').length,
          degraded: appStatuses.filter(s => s === 'degraded').length,
          unhealthy: appStatuses.filter(s => s === 'unhealthy').length
        }
      });
    } catch (error) {
      logger.error('Application health check failed:', error);
      res.status(503).json({
        overall: 'unhealthy',
        error: 'Application health check failed',
        timestamp: new Date().toISOString(),
        application: {},
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 }
      });
    }
  };

  /**
   * Database health check endpoint
   * Specific health check for database connectivity
   */
  public databaseHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.systemHealthService.checkDatabaseHealth();
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        service: 'database',
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Database health check failed:', error);
      res.status(503).json({
        service: 'database',
        status: 'unhealthy',
        error: 'Database health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Redis health check endpoint
   * Specific health check for Redis connectivity
   */
  public redisHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.systemHealthService.checkRedisHealth();
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        service: 'redis',
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Redis health check failed:', error);
      res.status(503).json({
        service: 'redis',
        status: 'unhealthy',
        error: 'Redis health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Exchange APIs health check endpoint
   * Specific health check for exchange API connectivity
   */
  public exchangesHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.systemHealthService.checkExchangesHealth();
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        service: 'exchanges',
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Exchanges health check failed:', error);
      res.status(503).json({
        service: 'exchanges',
        status: 'unhealthy',
        error: 'Exchanges health check failed',
        timestamp: new Date().toISOString(),
        exchangeDetails: {}
      });
    }
  };

  /**
   * WebSocket health check endpoint
   * Specific health check for WebSocket server
   */
  public websocketHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.systemHealthService.checkWebSocketHealth();
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        service: 'websocket',
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('WebSocket health check failed:', error);
      res.status(503).json({
        service: 'websocket',
        status: 'unhealthy',
        error: 'WebSocket health check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Paper trading safety check endpoint
   * Validates paper trading safety configuration
   */
  public paperTradingSafety = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.systemHealthService.checkPaperTradingSafety();
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        service: 'paperTradingSafety',
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Paper trading safety check failed:', error);
      res.status(503).json({
        service: 'paperTradingSafety',
        status: 'unhealthy',
        error: 'Paper trading safety check failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Service status summary endpoint
   * Returns status of all monitored services
   */
  public serviceStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const serviceStatuses = this.systemHealthService.getAllServiceStatuses();
      const monitoringServices = this.monitoring.getServiceStatuses();
      
      // Combine both monitoring systems
      const combinedStatuses = {
        systemHealth: serviceStatuses.reduce((acc, service) => {
          acc[service.name] = {
            status: service.status,
            lastCheck: service.lastCheck.toISOString(),
            responseTime: service.responseTime,
            error: service.error,
            details: service.details
          };
          return acc;
        }, {} as any),
        monitoring: monitoringServices.reduce((acc, service) => {
          acc[service.name] = {
            status: service.status,
            lastCheck: new Date(service.lastCheck).toISOString(),
            responseTime: service.responseTime,
            error: service.error
          };
          return acc;
        }, {} as any)
      };
      
      res.json({
        timestamp: new Date().toISOString(),
        services: combinedStatuses
      });
    } catch (error) {
      logger.error('Error getting service statuses:', error);
      res.status(500).json({ 
        error: 'Failed to get service statuses',
        timestamp: new Date().toISOString()
      });
    }
  };

  private extractHealthResult(
    settledResult: PromiseSettledResult<any>,
    serviceName: string
  ): any {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      logger.error(`Health check failed for ${serviceName}:`, settledResult.reason);
      return {
        status: 'unhealthy',
        message: `Health check failed for ${serviceName}`,
        responseTime: 0,
        error: settledResult.reason?.message || 'Unknown error'
      };
    }
  }

  private async performDeepHealthChecks(): Promise<Record<string, { status: string; message: string; [key: string]: any }>> {
    const checks: Record<string, { status: string; message: string; [key: string]: any }> = {};

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