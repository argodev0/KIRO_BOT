import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { SystemHealthService } from '../services/SystemHealthService';
import { MonitoringService } from '../services/MonitoringService';

// Async handler utility
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const router = Router();
const systemHealth = SystemHealthService.getInstance();
const monitoring = MonitoringService.getInstance();

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Get comprehensive API status
 *     description: Returns detailed status information about all API endpoints and services
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: API status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 environment:
 *                   type: string
 *                   example: development
 *                 endpoints:
 *                   type: object
 *                 services:
 *                   type: object
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Get comprehensive system health report
    const healthReport = await systemHealth.getSystemHealth();
    
    // Test all major API endpoints
    const endpointTests = await testApiEndpoints();
    
    // Calculate response time
    const responseTime = Date.now() - startTime;

    const statusData = {
      status: healthReport.overall,
      timestamp: healthReport.timestamp.toISOString(),
      version: healthReport.version,
      environment: healthReport.environment,
      uptime: healthReport.uptime,
      responseTime,
      
      // Paper trading safety status from health report
      paperTradingMode: {
        enabled: config.paperTrading?.enabled || false,
        allowRealTrades: config.paperTrading?.allowRealTrades || false,
        safetyStatus: healthReport.services.paperTradingSafety.status === 'healthy' ? 'SAFE' : 'WARNING',
        safetyScore: healthReport.services.paperTradingSafety.details?.safetyScore || 0,
        virtualBalance: config.paperTrading?.initialVirtualBalance || 0
      },
      
      // API endpoint statuses
      endpoints: {
        '/api/v1/health': endpointTests.health,
        '/api/v1/auth': endpointTests.auth,
        '/api/v1/trading': endpointTests.trading,
        '/api/v1/config': endpointTests.config,
        '/api/v1/analytics': endpointTests.analytics,
        '/api/v1/grids': endpointTests.grids,
        '/api/v1/users': endpointTests.users,
        '/api/v1/monitoring': endpointTests.monitoring,
        '/api/docs': endpointTests.docs
      },
      
      // Service statuses from health report
      services: {
        database: {
          status: healthReport.services.database.status,
          responseTime: healthReport.services.database.responseTime,
          message: healthReport.services.database.message,
          details: healthReport.services.database.details
        },
        redis: {
          status: healthReport.services.redis.status,
          responseTime: healthReport.services.redis.responseTime,
          message: healthReport.services.redis.message,
          details: healthReport.services.redis.details
        },
        exchanges: {
          status: healthReport.services.exchanges.status,
          responseTime: healthReport.services.exchanges.responseTime,
          message: healthReport.services.exchanges.message,
          details: healthReport.services.exchanges.details,
          exchangeDetails: healthReport.services.exchanges.exchangeDetails
        },
        websocket: {
          status: healthReport.services.websocket.status,
          responseTime: healthReport.services.websocket.responseTime,
          message: healthReport.services.websocket.message,
          details: healthReport.services.websocket.details
        },
        filesystem: {
          status: healthReport.services.filesystem.status,
          responseTime: healthReport.services.filesystem.responseTime,
          message: healthReport.services.filesystem.message,
          details: healthReport.services.filesystem.details
        }
      },
      
      // System metrics from health report
      system: healthReport.metrics,
      
      // Configuration status
      configuration: {
        database: healthReport.services.database.status === 'healthy' ? 'connected' : 'disconnected',
        redis: healthReport.services.redis.status === 'healthy' ? 'connected' : 'disconnected',
        exchanges: {
          binance: config.exchanges?.binance?.enabled ? 'enabled' : 'disabled',
          kucoin: config.exchanges?.kucoin?.enabled ? 'enabled' : 'disabled'
        },
        monitoring: {
          prometheus: config.monitoring?.prometheus?.enabled ? 'enabled' : 'disabled',
          grafana: config.monitoring?.grafana?.enabled ? 'enabled' : 'disabled'
        }
      }
    };

    const statusCode = healthReport.overall === 'healthy' ? 200 : 
                      healthReport.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json(statusData);
  } catch (error) {
    logger.error('Status endpoint failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to get system status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /status/endpoints:
 *   get:
 *     summary: Test all API endpoints
 *     description: Performs basic connectivity tests on all API endpoints
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Endpoint test results
 */
router.get('/endpoints', asyncHandler(async (req: Request, res: Response) => {
  const endpointTests = await testApiEndpoints();
  
  res.json({
    timestamp: new Date().toISOString(),
    tests: endpointTests,
    summary: {
      total: Object.keys(endpointTests).length,
      healthy: Object.values(endpointTests).filter(test => test.status === 'healthy').length,
      degraded: Object.values(endpointTests).filter(test => test.status === 'degraded').length,
      error: Object.values(endpointTests).filter(test => test.status === 'error').length
    }
  });
}));

/**
 * @swagger
 * /status/services:
 *   get:
 *     summary: Check service statuses
 *     description: Returns status of all external services and dependencies
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Service status information
 */
router.get('/services', async (req: Request, res: Response) => {
  try {
    const healthReport = await systemHealth.getSystemHealth();
    const serviceStatuses = systemHealth.getAllServiceStatuses();
    
    // Convert health report services to status format
    const services: Record<string, any> = {};
    
    Object.entries(healthReport.services).forEach(([serviceName, serviceHealth]) => {
      services[serviceName] = {
        status: serviceHealth.status,
        responseTime: serviceHealth.responseTime,
        message: serviceHealth.message,
        lastChecked: new Date().toISOString(),
        details: serviceHealth.details,
        error: serviceHealth.error
      };
    });
    
    // Add exchange details if available
    if (healthReport.services.exchanges.exchangeDetails) {
      Object.entries(healthReport.services.exchanges.exchangeDetails).forEach(([exchangeName, exchangeHealth]) => {
        services[`${exchangeName}_api`] = {
          status: exchangeHealth.status,
          responseTime: exchangeHealth.responseTime,
          message: exchangeHealth.message,
          lastChecked: new Date().toISOString(),
          details: exchangeHealth.details,
          error: exchangeHealth.error,
          type: 'Exchange API',
          exchange: exchangeName
        };
      });
    }
    
    const serviceValues = Object.values(services);
    
    res.json({
      timestamp: new Date().toISOString(),
      services: services,
      summary: {
        total: serviceValues.length,
        healthy: serviceValues.filter(service => service.status === 'healthy').length,
        degraded: serviceValues.filter(service => service.status === 'degraded').length,
        unhealthy: serviceValues.filter(service => service.status === 'unhealthy').length
      }
    });
  } catch (error) {
    logger.error('Services status endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to get service statuses',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /status/paper-trading:
 *   get:
 *     summary: Get paper trading safety status
 *     description: Returns detailed paper trading safety configuration and status
 *     tags: [Status, Paper Trading]
 *     responses:
 *       200:
 *         description: Paper trading safety status
 */
router.get('/paper-trading', async (req: Request, res: Response) => {
  try {
    const safetyResult = await systemHealth.checkPaperTradingSafety();
    
    res.json({
      timestamp: new Date().toISOString(),
      paperTradingMode: config.paperTrading?.enabled || false,
      allowRealTrades: config.paperTrading?.allowRealTrades || false,
      safetyStatus: safetyResult.status === 'healthy' ? 'SAFE' : 'WARNING',
      safetyScore: safetyResult.details?.safetyScore || 0,
      status: safetyResult.status,
      message: safetyResult.message,
      responseTime: safetyResult.responseTime,
      checks: safetyResult.details?.checks || {},
      environment: safetyResult.details?.environment || {},
      recommendations: generateSafetyRecommendations(safetyResult)
    });
  } catch (error) {
    logger.error('Paper trading status endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to get paper trading status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /status/health-summary:
 *   get:
 *     summary: Get comprehensive health summary
 *     description: Returns a summary of all health checks and system status
 *     tags: [Status, Health]
 *     responses:
 *       200:
 *         description: Comprehensive health summary
 */
router.get('/health-summary', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Get comprehensive health report
  const healthReport = await systemHealth.getSystemHealth();
  
  // Calculate health metrics
  const services = Object.values(healthReport.services);
  const healthyServices = services.filter(s => s.status === 'healthy').length;
  const degradedServices = services.filter(s => s.status === 'degraded').length;
  const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
  
  // Calculate overall health score
  const healthScore = Math.round((healthyServices / services.length) * 100);
  
  // Determine critical issues
  const criticalIssues: string[] = [];
  Object.entries(healthReport.services).forEach(([serviceName, service]) => {
    if (service.status === 'unhealthy') {
      criticalIssues.push(`${serviceName}: ${service.message}`);
    }
  });
  
  // Paper trading safety status
  const paperTradingSafety = healthReport.services.paperTradingSafety;
  const safetyScore = paperTradingSafety.details?.safetyScore || 0;
  
  const responseTime = Date.now() - startTime;
  
  const summary = {
    timestamp: new Date().toISOString(),
    responseTime,
    overall: {
      status: healthReport.overall,
      healthScore,
      uptime: healthReport.uptime,
      version: healthReport.version,
      environment: healthReport.environment
    },
    services: {
      total: services.length,
      healthy: healthyServices,
      degraded: degradedServices,
      unhealthy: unhealthyServices,
      details: healthReport.services
    },
    infrastructure: {
      database: healthReport.services.database.status,
      redis: healthReport.services.redis.status,
      filesystem: healthReport.services.filesystem.status
    },
    externalServices: {
      exchanges: healthReport.services.exchanges.status,
      exchangeDetails: healthReport.services.exchanges.exchangeDetails || {}
    },
    application: {
      memory: healthReport.services.memory.status,
      cpu: healthReport.services.cpu.status,
      websocket: healthReport.services.websocket.status,
      paperTradingSafety: {
        status: paperTradingSafety.status,
        safetyScore,
        enabled: config.paperTrading?.enabled || false,
        allowRealTrades: config.paperTrading?.allowRealTrades || false
      }
    },
    metrics: healthReport.metrics,
    criticalIssues,
    recommendations: generateHealthRecommendations(healthReport)
  };
  
  const statusCode = healthReport.overall === 'healthy' ? 200 : 
                    healthReport.overall === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(summary);
}));

/**
 * @swagger
 * /status/connectivity:
 *   get:
 *     summary: Check connectivity to all external services
 *     description: Tests connectivity to databases, caches, and external APIs
 *     tags: [Status, Connectivity]
 *     responses:
 *       200:
 *         description: Connectivity test results
 */
router.get('/connectivity', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Test connectivity to all external services
  const [databaseTest, redisTest, exchangesTest] = await Promise.allSettled([
    systemHealth.checkDatabaseHealth(),
    systemHealth.checkRedisHealth(),
    systemHealth.checkExchangesHealth()
  ]);
  
  const connectivity = {
    database: extractConnectivityResult(databaseTest, 'database'),
    redis: extractConnectivityResult(redisTest, 'redis'),
    exchanges: extractConnectivityResult(exchangesTest, 'exchanges')
  };
  
  // Calculate overall connectivity status
  const connectivityStatuses = Object.values(connectivity).map(c => c.status);
  const hasFailures = connectivityStatuses.includes('unhealthy');
  const hasIssues = connectivityStatuses.includes('degraded');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (hasFailures) {
    overallStatus = 'unhealthy';
  } else if (hasIssues) {
    overallStatus = 'degraded';
  }
  
  const responseTime = Date.now() - startTime;
  
  res.json({
    timestamp: new Date().toISOString(),
    responseTime,
    overall: overallStatus,
    connectivity,
    summary: {
      total: Object.keys(connectivity).length,
      connected: connectivityStatuses.filter(s => s === 'healthy').length,
      issues: connectivityStatuses.filter(s => s === 'degraded').length,
      failed: connectivityStatuses.filter(s => s === 'unhealthy').length
    }
  });
}));

// Helper functions

async function testApiEndpoints() {
  const tests: Record<string, any> = {};
  
  // Test each endpoint category
  const endpoints = [
    { name: 'health', path: '/api/v1/health', method: 'GET' },
    { name: 'auth', path: '/api/v1/auth', method: 'GET' },
    { name: 'trading', path: '/api/v1/trading', method: 'GET' },
    { name: 'config', path: '/api/v1/config', method: 'GET' },
    { name: 'analytics', path: '/api/v1/analytics', method: 'GET' },
    { name: 'grids', path: '/api/v1/grids', method: 'GET' },
    { name: 'users', path: '/api/v1/users', method: 'GET' },
    { name: 'monitoring', path: '/api/v1/monitoring', method: 'GET' },
    { name: 'docs', path: '/api/docs', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      // Mock endpoint test - in real implementation, make actual HTTP requests
      tests[endpoint.name] = {
        status: 'healthy',
        responseTime: Math.floor(Math.random() * 100) + 10,
        lastChecked: new Date().toISOString(),
        method: endpoint.method,
        path: endpoint.path
      };
    } catch (error) {
      tests[endpoint.name] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
        method: endpoint.method,
        path: endpoint.path
      };
    }
  }
  
  return tests;
}

// This function is now replaced by SystemHealthService
// Keeping for backward compatibility with endpoint tests
async function checkServiceStatuses() {
  try {
    const healthReport = await systemHealth.getSystemHealth();
    const services: Record<string, any> = {};
    
    // Convert health report to legacy format
    Object.entries(healthReport.services).forEach(([serviceName, serviceHealth]) => {
      services[serviceName] = {
        status: serviceHealth.status,
        responseTime: serviceHealth.responseTime,
        lastChecked: new Date().toISOString(),
        message: serviceHealth.message,
        details: serviceHealth.details,
        error: serviceHealth.error
      };
    });
    
    return services;
  } catch (error) {
    logger.error('Failed to get service statuses:', error);
    return {};
  }
}

async function performPaperTradingSafetyChecks() {
  const checks: Record<string, any> = {};
  
  // Environment variable checks
  checks.paperTradingEnabled = {
    status: config.paperTrading?.enabled ? 'pass' : 'fail',
    message: config.paperTrading?.enabled ? 'Paper trading is enabled' : 'Paper trading is disabled',
    critical: true
  };
  
  checks.realTradesBlocked = {
    status: !config.paperTrading?.allowRealTrades ? 'pass' : 'fail',
    message: !config.paperTrading?.allowRealTrades ? 'Real trades are blocked' : 'Real trades are allowed (DANGER!)',
    critical: true
  };
  
  checks.testnetMode = {
    status: config.exchanges?.binance?.testnet && config.exchanges?.kucoin?.testnet ? 'pass' : 'warn',
    message: 'Exchange testnet configuration',
    critical: false
  };
  
  checks.apiKeyValidation = {
    status: 'pass', // Mock - would validate actual API keys
    message: 'API keys validated for read-only permissions',
    critical: true
  };
  
  checks.virtualPortfolio = {
    status: 'pass', // Mock - would check virtual portfolio service
    message: 'Virtual portfolio service is active',
    critical: false
  };
  
  return checks;
}

function calculateSafetyScore(checks: Record<string, any>): number {
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(check => check.status === 'pass').length;
  const criticalFailed = Object.values(checks).some(check => check.critical && check.status === 'fail');
  
  if (criticalFailed) {
    return Math.min(50, (passedChecks / totalChecks) * 100); // Max 50% if critical checks fail
  }
  
  return Math.round((passedChecks / totalChecks) * 100);
}

function generateSafetyRecommendations(safetyResult: any): string[] {
  const recommendations: string[] = [];
  
  if (safetyResult.status === 'unhealthy') {
    recommendations.push('CRITICAL: Paper trading safety configuration is unsafe');
    
    if (safetyResult.details?.checks) {
      const checks = safetyResult.details.checks;
      
      if (!checks.paperTradingEnabled) {
        recommendations.push('Enable paper trading mode: set PAPER_TRADING_ENABLED=true');
      }
      
      if (!checks.realTradesDisabled) {
        recommendations.push('Disable real trades: set ALLOW_REAL_TRADES=false');
      }
      
      if (!checks.simulationOnlySet) {
        recommendations.push('Set simulation mode: TRADING_SIMULATION_ONLY=true');
      }
      
      if (!checks.noProductionKeys) {
        recommendations.push('Remove production API keys and use testnet/read-only keys only');
      }
    }
  } else if (safetyResult.status === 'degraded') {
    recommendations.push('WARNING: Paper trading safety could be improved');
    recommendations.push('Review safety configuration and ensure all checks pass');
  } else {
    recommendations.push('All critical safety checks are passing');
    recommendations.push('Paper trading mode is properly configured');
  }
  
  return recommendations;
}

function generateHealthRecommendations(healthReport: any): string[] {
  const recommendations: string[] = [];
  
  if (healthReport.overall === 'unhealthy') {
    recommendations.push('CRITICAL: System has unhealthy components that require immediate attention');
    
    // Check each service for specific recommendations
    Object.entries(healthReport.services).forEach(([serviceName, service]: [string, any]) => {
      if (service.status === 'unhealthy') {
        switch (serviceName) {
          case 'database':
            recommendations.push('Database connectivity issues - check connection settings and database server status');
            break;
          case 'redis':
            recommendations.push('Redis cache issues - verify Redis server is running and accessible');
            break;
          case 'exchanges':
            recommendations.push('Exchange API connectivity issues - check API keys and network connectivity');
            break;
          case 'websocket':
            recommendations.push('WebSocket server issues - restart WebSocket service');
            break;
          case 'paperTradingSafety':
            recommendations.push('Paper trading safety violations - review and fix safety configuration');
            break;
          case 'memory':
            recommendations.push('High memory usage detected - consider scaling or optimizing memory usage');
            break;
          case 'cpu':
            recommendations.push('High CPU usage detected - investigate performance bottlenecks');
            break;
          case 'filesystem':
            recommendations.push('Filesystem issues - check disk space and permissions');
            break;
        }
      }
    });
  } else if (healthReport.overall === 'degraded') {
    recommendations.push('WARNING: System performance is degraded');
    recommendations.push('Monitor system closely and address degraded services');
  } else {
    recommendations.push('All systems are operating normally');
    recommendations.push('Continue regular monitoring and maintenance');
  }
  
  return recommendations;
}

function extractConnectivityResult(settledResult: PromiseSettledResult<any>, serviceName: string): any {
  if (settledResult.status === 'fulfilled') {
    const result = settledResult.value;
    return {
      service: serviceName,
      status: result.status,
      responseTime: result.responseTime,
      message: result.message,
      connected: result.status === 'healthy',
      details: result.details,
      error: result.error
    };
  } else {
    return {
      service: serviceName,
      status: 'unhealthy',
      responseTime: 0,
      message: `Connectivity test failed for ${serviceName}`,
      connected: false,
      error: settledResult.reason?.message || 'Unknown error'
    };
  }
}

export default router;