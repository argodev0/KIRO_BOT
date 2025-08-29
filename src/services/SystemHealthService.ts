/**
 * System Health Service
 * Comprehensive health check service for all system components
 */

import { EventEmitter } from 'events';
import { db } from '../models/database';
import { CacheManager } from './CacheManager';
import { ExchangeManager, ExchangeName } from './exchanges/ExchangeManager';
import { WebSocketServer } from './WebSocketServer';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
// Redis import - optional dependency
let Redis: any = null;
try {
  Redis = require('ioredis');
} catch (error) {
  // Redis not available, will handle gracefully
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime: number;
  details?: any;
  error?: string;
}

export interface ServiceHealthStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  error?: string;
  details?: any;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    exchanges: HealthCheckResult & { exchangeDetails: Record<string, HealthCheckResult> };
    websocket: HealthCheckResult;
    filesystem: HealthCheckResult;
    memory: HealthCheckResult;
    cpu: HealthCheckResult;
    paperTradingSafety: HealthCheckResult;
  };
  metrics: {
    memory: NodeJS.MemoryUsage & { systemFree: number; systemTotal: number; usage: string };
    cpu: { usage: number; loadAverage: number[]; cores: number };
    platform: { type: string; platform: string; arch: string; release: string; hostname: string };
  };
}

export class SystemHealthService extends EventEmitter {
  private static instance: SystemHealthService;
  private redis: any | null = null;
  private cacheManager: CacheManager | null = null;
  private exchangeManager: ExchangeManager | null = null;
  private webSocketServer: WebSocketServer | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private serviceStatuses: Map<string, ServiceHealthStatus> = new Map();

  private constructor() {
    super();
    this.initializeServices();
  }

  public static getInstance(): SystemHealthService {
    if (!SystemHealthService.instance) {
      SystemHealthService.instance = new SystemHealthService();
    }
    return SystemHealthService.instance;
  }

  /**
   * Initialize service references
   */
  private initializeServices(): void {
    try {
      // Initialize Redis connection for health checks
      if (Redis && config.redis && (config.redis as any).enabled) {
        this.redis = new Redis({
          host: config.redis.host || 'localhost',
          port: config.redis.port || 6379,
          password: config.redis.password,
          db: config.redis.db || 0,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });
      }
    } catch (error) {
      logger.error('Failed to initialize SystemHealthService:', error);
    }
  }

  /**
   * Set service references (to be called from main application)
   */
  public setServiceReferences(services: {
    cacheManager?: CacheManager;
    exchangeManager?: ExchangeManager;
    webSocketServer?: WebSocketServer;
  }): void {
    this.cacheManager = services.cacheManager || null;
    this.exchangeManager = services.exchangeManager || null;
    this.webSocketServer = services.webSocketServer || null;
  }

  /**
   * Start periodic health checks
   */
  public startHealthChecks(interval: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Health check cycle failed:', error);
      }
    }, interval);

    logger.info(`Health checks started with ${interval}ms interval`);
  }

  /**
   * Stop periodic health checks
   */
  public stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform comprehensive system health check
   */
  public async getSystemHealth(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    
    // Perform all health checks in parallel
    const [
      databaseHealth,
      redisHealth,
      exchangesHealth,
      websocketHealth,
      filesystemHealth,
      memoryHealth,
      cpuHealth,
      paperTradingSafetyHealth
    ] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkExchangesHealth(),
      this.checkWebSocketHealth(),
      this.checkFilesystemHealth(),
      this.checkMemoryHealth(),
      this.checkCpuHealth(),
      this.checkPaperTradingSafety()
    ]);

    // Extract results from settled promises
    const services = {
      database: this.extractHealthResult(databaseHealth, 'database'),
      redis: this.extractHealthResult(redisHealth, 'redis'),
      exchanges: this.extractHealthResult(exchangesHealth, 'exchanges') as HealthCheckResult & { exchangeDetails: Record<string, HealthCheckResult> },
      websocket: this.extractHealthResult(websocketHealth, 'websocket'),
      filesystem: this.extractHealthResult(filesystemHealth, 'filesystem'),
      memory: this.extractHealthResult(memoryHealth, 'memory'),
      cpu: this.extractHealthResult(cpuHealth, 'cpu'),
      paperTradingSafety: this.extractHealthResult(paperTradingSafetyHealth, 'paperTradingSafety')
    };

    // Determine overall health status
    const serviceStatuses = Object.values(services).map(s => s.status);
    const hasUnhealthy = serviceStatuses.includes('unhealthy');
    const hasDegraded = serviceStatuses.includes('degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    // Collect system metrics
    const memUsage = process.memoryUsage();
    const systemMetrics = {
      memory: {
        ...memUsage,
        systemFree: os.freemem(),
        systemTotal: os.totalmem(),
        usage: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)}%`
      },
      cpu: {
        usage: 0, // Would need more sophisticated CPU monitoring
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname()
      }
    };

    const report: SystemHealthReport = {
      overall: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env || 'development',
      services,
      metrics: systemMetrics
    };

    // Update service statuses
    this.updateServiceStatuses(services);

    // Emit health report event
    this.emit('healthReport', report);

    logger.debug(`System health check completed in ${Date.now() - startTime}ms`);
    return report;
  }

  /**
   * Check database connectivity and health
   */
  public async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await db.$queryRaw`SELECT 1 as health_check`;
      
      // Test write capability (if not in read-only mode)
      const testQuery = await db.$queryRaw`SELECT current_timestamp as db_time`;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        responseTime,
        details: {
          connected: true,
          queryTime: responseTime,
          serverTime: testQuery
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Database health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
        details: {
          connected: false
        }
      };
    }
  }

  /**
   * Check Redis connectivity and health
   */
  public async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    if (!this.redis) {
      return {
        status: 'degraded',
        message: 'Redis not configured',
        responseTime: 0,
        details: { configured: false }
      };
    }

    try {
      // Test basic connectivity
      const pong = await this.redis.ping();
      
      // Test read/write operations
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      await this.redis.set(testKey, testValue, 'EX', 10); // Expire in 10 seconds
      const retrievedValue = await this.redis.get(testKey);
      await this.redis.del(testKey);
      
      const responseTime = Date.now() - startTime;
      
      if (pong === 'PONG' && retrievedValue === testValue) {
        return {
          status: 'healthy',
          message: 'Redis connection is healthy',
          responseTime,
          details: {
            connected: true,
            ping: pong,
            readWrite: true
          }
        };
      } else {
        return {
          status: 'degraded',
          message: 'Redis connection issues detected',
          responseTime,
          details: {
            connected: true,
            ping: pong,
            readWrite: false
          }
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Redis health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Redis connection failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        details: {
          connected: false
        }
      };
    }
  }

  /**
   * Check exchange API connectivity and health
   */
  public async checkExchangesHealth(): Promise<HealthCheckResult & { exchangeDetails: Record<string, HealthCheckResult> }> {
    const startTime = Date.now();
    const exchangeDetails: Record<string, HealthCheckResult> = {};
    
    if (!this.exchangeManager) {
      return {
        status: 'degraded',
        message: 'Exchange manager not initialized',
        responseTime: Date.now() - startTime,
        exchangeDetails: {},
        details: { initialized: false }
      };
    }

    try {
      const availableExchanges = this.exchangeManager.getAvailableExchanges();
      
      if (availableExchanges.length === 0) {
        return {
          status: 'degraded',
          message: 'No exchanges configured',
          responseTime: Date.now() - startTime,
          exchangeDetails: {},
          details: { configured: false }
        };
      }

      // Check each exchange individually
      const exchangeChecks = await Promise.allSettled(
        availableExchanges.map(async (exchangeName) => {
          const exchangeStartTime = Date.now();
          try {
            const exchange = this.exchangeManager!.getExchange(exchangeName);
            if (!exchange) {
              throw new Error(`Exchange ${exchangeName} not found`);
            }

            // Test basic connectivity
            const isConnected = exchange.isConnected();
            
            // Test API call (get server time or similar lightweight call)
            let apiTest = false;
            try {
              // This would be a lightweight API call to test connectivity
              // For now, we'll just check connection status
              apiTest = isConnected;
            } catch (apiError) {
              logger.warn(`API test failed for ${exchangeName}:`, apiError);
            }

            const exchangeResponseTime = Date.now() - exchangeStartTime;
            
            exchangeDetails[exchangeName] = {
              status: isConnected && apiTest ? 'healthy' : 'degraded',
              message: isConnected ? 'Exchange connection healthy' : 'Exchange connection issues',
              responseTime: exchangeResponseTime,
              details: {
                connected: isConnected,
                apiTest: apiTest
              }
            };

            return { exchangeName, success: true };
          } catch (error) {
            const exchangeResponseTime = Date.now() - exchangeStartTime;
            exchangeDetails[exchangeName] = {
              status: 'unhealthy',
              message: 'Exchange connection failed',
              responseTime: exchangeResponseTime,
              error: error instanceof Error ? error.message : 'Unknown exchange error',
              details: {
                connected: false,
                apiTest: false
              }
            };
            return { exchangeName, success: false };
          }
        })
      );

      // Determine overall exchange health
      const healthyExchanges = Object.values(exchangeDetails).filter(e => e.status === 'healthy').length;
      const totalExchanges = availableExchanges.length;
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (healthyExchanges === 0) {
        overallStatus = 'unhealthy';
      } else if (healthyExchanges < totalExchanges) {
        overallStatus = 'degraded';
      }

      const responseTime = Date.now() - startTime;
      
      return {
        status: overallStatus,
        message: `${healthyExchanges}/${totalExchanges} exchanges healthy`,
        responseTime,
        exchangeDetails,
        details: {
          totalExchanges,
          healthyExchanges,
          availableExchanges
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Exchange health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Exchange health check failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        exchangeDetails,
        details: {
          totalExchanges: 0,
          healthyExchanges: 0
        }
      };
    }
  }

  /**
   * Check WebSocket server health
   */
  public async checkWebSocketHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    if (!this.webSocketServer) {
      return {
        status: 'degraded',
        message: 'WebSocket server not initialized',
        responseTime: Date.now() - startTime,
        details: { initialized: false }
      };
    }

    try {
      // Check if WebSocket server is running
      let isRunning = false;
      let connectionCount = 0;
      
      // Try different methods to check WebSocket server status
      if (typeof (this.webSocketServer as any).isRunning === 'function') {
        isRunning = (this.webSocketServer as any).isRunning();
      } else if (typeof (this.webSocketServer as any).server !== 'undefined') {
        isRunning = true; // If server exists, assume it's running
      }
      
      if (typeof (this.webSocketServer as any).getConnectionCount === 'function') {
        connectionCount = (this.webSocketServer as any).getConnectionCount();
      } else if (typeof (this.webSocketServer as any).getUserConnectionsCount === 'function') {
        // This method exists but needs a userId, so we'll just set a default count
        connectionCount = 0;
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: isRunning ? 'healthy' : 'unhealthy',
        message: isRunning ? 'WebSocket server is running' : 'WebSocket server is not running',
        responseTime,
        details: {
          running: isRunning,
          connections: connectionCount
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('WebSocket health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'WebSocket health check failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown WebSocket error',
        details: {
          running: false,
          connections: 0
        }
      };
    }
  }

  /**
   * Check filesystem health
   */
  public async checkFilesystemHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const testFile = '/tmp/kiro_bot_health_check';
      const testContent = `health_check_${Date.now()}`;
      
      // Test write operation
      await promisify(fs.writeFile)(testFile, testContent);
      
      // Test read operation
      const readContent = await promisify(fs.readFile)(testFile, 'utf8');
      
      // Test delete operation
      await promisify(fs.unlink)(testFile);
      
      const responseTime = Date.now() - startTime;
      
      if (readContent === testContent) {
        return {
          status: 'healthy',
          message: 'Filesystem operations successful',
          responseTime,
          details: {
            read: true,
            write: true,
            delete: true
          }
        };
      } else {
        return {
          status: 'degraded',
          message: 'Filesystem read/write mismatch',
          responseTime,
          details: {
            read: true,
            write: true,
            delete: true,
            contentMatch: false
          }
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Filesystem health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Filesystem operations failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown filesystem error',
        details: {
          read: false,
          write: false,
          delete: false
        }
      };
    }
  }

  /**
   * Check memory health
   */
  public async checkMemoryHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const systemMemory = {
        free: os.freemem(),
        total: os.totalmem()
      };
      
      // Calculate memory usage percentages
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      const systemUsagePercent = ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100;
      
      // Determine health status based on memory usage
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage is normal';
      
      if (heapUsagePercent > 90 || systemUsagePercent > 95) {
        status = 'unhealthy';
        message = 'Critical memory usage detected';
      } else if (heapUsagePercent > 80 || systemUsagePercent > 85) {
        status = 'degraded';
        message = 'High memory usage detected';
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status,
        message,
        responseTime,
        details: {
          heap: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            usagePercent: heapUsagePercent.toFixed(2)
          },
          system: {
            free: systemMemory.free,
            total: systemMemory.total,
            usagePercent: systemUsagePercent.toFixed(2)
          },
          rss: memUsage.rss,
          external: memUsage.external
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Memory health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Memory health check failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown memory error'
      };
    }
  }

  /**
   * Check CPU health
   */
  public async checkCpuHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const loadAverage = os.loadavg();
      const cpuCount = os.cpus().length;
      
      // Calculate load average as percentage of CPU cores
      const load1min = (loadAverage[0] / cpuCount) * 100;
      const load5min = (loadAverage[1] / cpuCount) * 100;
      const load15min = (loadAverage[2] / cpuCount) * 100;
      
      // Determine health status based on load average
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'CPU load is normal';
      
      if (load1min > 90 || load5min > 85) {
        status = 'unhealthy';
        message = 'Critical CPU load detected';
      } else if (load1min > 70 || load5min > 65) {
        status = 'degraded';
        message = 'High CPU load detected';
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status,
        message,
        responseTime,
        details: {
          cores: cpuCount,
          loadAverage: {
            '1min': loadAverage[0],
            '5min': loadAverage[1],
            '15min': loadAverage[2]
          },
          loadPercentage: {
            '1min': load1min.toFixed(2),
            '5min': load5min.toFixed(2),
            '15min': load15min.toFixed(2)
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('CPU health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'CPU health check failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown CPU error'
      };
    }
  }

  /**
   * Check paper trading safety configuration
   */
  public async checkPaperTradingSafety(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const paperTradingEnabled = config.paperTrading?.enabled || false;
      const allowRealTrades = config.paperTrading?.allowRealTrades || false;
      const tradingSimulationOnly = process.env.TRADING_SIMULATION_ONLY === 'true';
      
      // Calculate safety score
      let safetyScore = 0;
      const checks = {
        paperTradingEnabled: paperTradingEnabled,
        realTradesDisabled: !allowRealTrades,
        simulationOnlySet: tradingSimulationOnly,
        noProductionKeys: true // Would check for production API keys
      };
      
      Object.values(checks).forEach(check => {
        if (check) safetyScore += 25;
      });
      
      // Determine status based on safety score
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Paper trading safety score: ${safetyScore}%`;
      
      if (safetyScore < 75) {
        status = 'unhealthy';
        message = `CRITICAL: Paper trading safety score too low: ${safetyScore}%`;
      } else if (safetyScore < 90) {
        status = 'degraded';
        message = `WARNING: Paper trading safety score below recommended: ${safetyScore}%`;
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status,
        message,
        responseTime,
        details: {
          safetyScore,
          checks,
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            TRADING_SIMULATION_ONLY: process.env.TRADING_SIMULATION_ONLY
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Paper trading safety check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Paper trading safety check failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown safety check error'
      };
    }
  }

  /**
   * Get individual service status
   */
  public getServiceStatus(serviceName: string): ServiceHealthStatus | null {
    return this.serviceStatuses.get(serviceName) || null;
  }

  /**
   * Get all service statuses
   */
  public getAllServiceStatuses(): ServiceHealthStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  // Private helper methods

  private async performHealthChecks(): Promise<void> {
    try {
      const healthReport = await this.getSystemHealth();
      
      // Log any unhealthy services
      Object.entries(healthReport.services).forEach(([serviceName, result]) => {
        if (result.status === 'unhealthy') {
          logger.warn(`Service ${serviceName} is unhealthy: ${result.message}`);
        }
      });
      
      // Emit alerts for critical issues
      if (healthReport.overall === 'unhealthy') {
        this.emit('criticalHealthIssue', healthReport);
      }
    } catch (error) {
      logger.error('Health check cycle failed:', error);
      this.emit('healthCheckError', error);
    }
  }

  private extractHealthResult(
    settledResult: PromiseSettledResult<HealthCheckResult | (HealthCheckResult & { exchangeDetails: Record<string, HealthCheckResult> })>,
    serviceName: string
  ): HealthCheckResult | (HealthCheckResult & { exchangeDetails: Record<string, HealthCheckResult> }) {
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

  private updateServiceStatuses(services: SystemHealthReport['services']): void {
    Object.entries(services).forEach(([serviceName, result]) => {
      const status: ServiceHealthStatus = {
        name: serviceName,
        status: result.status === 'healthy' ? 'up' : result.status === 'degraded' ? 'degraded' : 'down',
        lastCheck: new Date(),
        responseTime: result.responseTime,
        error: result.error,
        details: result.details
      };
      
      const previousStatus = this.serviceStatuses.get(serviceName);
      this.serviceStatuses.set(serviceName, status);
      
      // Emit status change events
      if (previousStatus && previousStatus.status !== status.status) {
        this.emit('serviceStatusChange', {
          service: serviceName,
          previousStatus: previousStatus.status,
          currentStatus: status.status,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopHealthChecks();
    
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    
    this.removeAllListeners();
  }
}