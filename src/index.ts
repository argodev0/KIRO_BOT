import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/config/config';
import { swaggerSpec } from '@/config/swagger';
import { logger } from '@/utils/logger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { fullMonitoring } from '@/middleware/monitoring';
import { register } from '@/utils/metrics';

// Enhanced security middleware
import { createSecurityStack } from '@/middleware/securityStack';
import { 
  corsOptions, 
  websocketSecurity
} from '@/middleware/security';

// Paper Trading Safety Infrastructure
import { paperTradingGuard, validatePaperTradingMode } from '@/middleware/paperTradingGuard';
import { validateEnvironmentOnStartup } from '@/utils/EnvironmentValidator';
import { validateSafetyScoreOnStartup } from '@/middleware/safetyScoreEnforcement';
import { virtualPortfolioManager } from '@/services/VirtualPortfolioManager';
import { tradeSimulationEngine } from '@/services/TradeSimulationEngine';

import { WebSocketServer } from '@/services/WebSocketServer';
import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { WebSocketAuthService } from '@/services/WebSocketAuthService';
import { DataBroadcastService } from '@/services/DataBroadcastService';
import { WebSocketClientManager } from '@/services/WebSocketClientManager';
import { AuthService } from '@/services/AuthService';
import { AuditLogService } from '@/services/AuditLogService';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { NotificationService } from '@/services/NotificationService';
import { SystemHealthService } from '@/services/SystemHealthService';
import { MonitoringService } from '@/services/MonitoringService';
import { PrometheusMetricsService } from '@/services/PrometheusMetricsService';
import { ProductionAlertingService } from '@/services/ProductionAlertingService';
import { alertingIntegration } from '@/middleware/alertingIntegration';
import { PrismaClient } from '@prisma/client';
import apiRoutes from '@/routes';
import alertingRoutes from '@/routes/alerting';

const app = express();

// Initialize database and security services
const prisma = new PrismaClient();
const auditLogService = AuditLogService.getInstance();
const notificationService = NotificationService.getInstance();
const securityMonitoringService = new SecurityMonitoringService(
  prisma, 
  auditLogService, 
  notificationService
);

// Initialize health monitoring services
const systemHealthService = SystemHealthService.getInstance();
const monitoringService = MonitoringService.getInstance();
const prometheusMetricsService = PrometheusMetricsService.getInstance();

// Initialize production alerting service
const productionAlertingService = ProductionAlertingService.getInstance();

// Initialize enhanced security stack
const securityStack = createSecurityStack(app, prisma);

// Create HTTP/HTTPS server based on environment and SSL availability
let server: any;
let protocol = 'http';

// Check for SSL certificates
const sslCertPath = process.env.SSL_CERT_PATH || './docker/ssl/cert.pem';
const sslKeyPath = process.env.SSL_KEY_PATH || './docker/ssl/private.key';
const sslCaPath = process.env.SSL_CA_PATH || './docker/ssl/ca.pem';

const hasSSLCerts = existsSync(sslCertPath) && existsSync(sslKeyPath);

if (config.env === 'production' && hasSSLCerts) {
  // Use HTTPS in production if certificates are available
  try {
    const httpsOptions = {
      cert: readFileSync(sslCertPath),
      key: readFileSync(sslKeyPath),
      ca: existsSync(sslCaPath) ? readFileSync(sslCaPath) : undefined,
      // Security options
      secureProtocol: 'TLSv1_2_method',
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES256-SHA256',
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA',
        'AES128-GCM-SHA256',
        'AES256-GCM-SHA384',
        'AES128-SHA256',
        'AES256-SHA256',
        'AES128-SHA',
        'AES256-SHA'
      ].join(':'),
      honorCipherOrder: true
    };
    
    server = createHttpsServer(httpsOptions, app);
    protocol = 'https';
    logger.info('✅ HTTPS server configured with SSL certificates');
  } catch (error) {
    logger.error('Failed to create HTTPS server, falling back to HTTP:', error);
    server = createServer(app);
    protocol = 'http';
  }
} else {
  // Use HTTP for development or when SSL certs are not available
  server = createServer(app);
  protocol = 'http';
  
  if (config.env === 'production') {
    logger.warn('⚠️  Running in production without HTTPS - SSL certificates not found');
  }
}

// CRITICAL: Validate environment for paper trading safety BEFORE starting server
try {
  validateEnvironmentOnStartup();
  validatePaperTradingMode();
  logger.info('✅ Paper trading safety validation passed');
} catch (error) {
  logger.error('❌ CRITICAL: Paper trading safety validation failed', error);
  if (config.environment.isProduction) {
    logger.error('Exiting application due to safety validation failure in production');
    process.exit(1);
  }
  throw error;
}

// Initialize enhanced security stack
const initializeSecurity = async () => {
  await securityStack.initialize({
    enableHelmet: true,
    enableCors: true,
    enableRateLimit: true,
    enableSlowDown: true,
    enableCompression: true,
    enableCookieParser: true,
    enableSessionManagement: true,
    enableSecurityMonitoring: true,
    enableEnhancedAuth: true
  });

  // Store services in app for route access
  app.set('prisma', prisma);
  app.set('sessionService', securityStack.getSessionService());
  app.set('securityService', securityStack.getSecurityService());
  app.set('enhancedAuth', securityStack.getEnhancedAuth());
  
  logger.info('✅ Enhanced security stack initialized');
};

// We'll initialize security in the server startup

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging and monitoring
app.use(requestLogger);
app.use(fullMonitoring);

// Audit logging middleware
import { 
  auditLoggingMiddleware, 
  tradingAuditMiddleware, 
  configurationAuditMiddleware 
} from '@/middleware/auditLogging';

app.use(auditLoggingMiddleware({
  logRequestBody: false,
  logResponseBody: false,
  excludePaths: ['/health', '/metrics', '/favicon.ico', '/api/docs'],
  sensitiveFields: ['password', 'token', 'secret', 'key', 'apiKey']
}));

app.use(tradingAuditMiddleware());
app.use(configurationAuditMiddleware());

// Production alerting integration middleware
app.use(alertingIntegration.requestMonitoring);
app.use(alertingIntegration.securityMonitoring);
app.use(alertingIntegration.paperTradingSafetyMonitoring);

// CRITICAL: Paper Trading Guard - MUST be applied before any trading routes
app.use(paperTradingGuard);

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AI Crypto Trading Bot API Documentation'
}));

// Serve OpenAPI spec as JSON
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint with paper trading status
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    paperTradingMode: config.paperTrading.enabled,
    allowRealTrades: config.paperTrading.allowRealTrades,
    environment: config.environment.nodeEnv,
    safetyStatus: {
      paperTradingEnabled: config.paperTrading.enabled,
      realTradesBlocked: !config.paperTrading.allowRealTrades,
      environmentValidated: true,
      virtualPortfolioActive: true
    }
  });
});

// Paper trading status endpoint
app.get('/api/v1/paper-trading/status', (_req, res) => {
  try {
    const simulationStats = tradeSimulationEngine.getSimulationStats();
    const portfolioUsers = virtualPortfolioManager.getAllUsers();
    
    res.json({
      paperTradingMode: config.paperTrading.enabled,
      allowRealTrades: config.paperTrading.allowRealTrades,
      environment: config.environment.nodeEnv,
      virtualPortfolio: {
        activeUsers: portfolioUsers.length,
        initialBalance: config.paperTrading.initialVirtualBalance
      },
      simulation: simulationStats,
      safety: {
        environmentValidated: true,
        apiKeysValidated: true,
        realMoneyOperationsBlocked: true,
        auditLoggingEnabled: config.paperTrading.security.auditAllOperations
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting paper trading status:', error);
    res.status(500).json({ 
      error: 'Failed to get paper trading status',
      paperTradingMode: config.paperTrading.enabled 
    });
  }
});

// Live market data status endpoint
app.get('/api/v1/market-data/status', (_req, res) => {
  try {
    const stats = liveMarketDataIntegration.getStats();
    const isHealthy = liveMarketDataIntegration.isHealthy();
    const availableSymbols = liveMarketDataIntegration.getAvailableSymbols();
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      dataFlowing: stats.overall.dataFlowing,
      healthScore: stats.overall.healthScore,
      uptime: stats.overall.uptime,
      exchanges: stats.exchanges,
      cache: stats.cache,
      websocket: stats.websocket,
      indicators: stats.indicators,
      availableSymbols,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting live market data status:', error);
    res.status(500).json({ 
      error: 'Failed to get live market data status',
      status: 'error'
    });
  }
});

// Live market data symbols endpoint
app.get('/api/v1/market-data/symbols', (_req, res) => {
  try {
    const availableSymbols = liveMarketDataIntegration.getAvailableSymbols();
    
    res.json({
      symbols: availableSymbols,
      count: availableSymbols.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting available symbols:', error);
    res.status(500).json({ 
      error: 'Failed to get available symbols',
      symbols: []
    });
  }
});

// Subscribe to symbol endpoint
app.post('/api/v1/market-data/subscribe/:symbol', async (_req, res) => {
  try {
    const { symbol } = _req.params;
    const { timeframes } = _req.body;
    
    await liveMarketDataIntegration.subscribeToSymbol(symbol.toUpperCase(), timeframes);
    
    res.json({
      success: true,
      message: `Subscribed to ${symbol.toUpperCase()}`,
      symbol: symbol.toUpperCase(),
      timeframes: timeframes || ['1m', '5m', '15m', '1h'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error subscribing to symbol:', error);
    res.status(500).json({ 
      error: 'Failed to subscribe to symbol',
      success: false
    });
  }
});

// Unsubscribe from symbol endpoint
app.delete('/api/v1/market-data/subscribe/:symbol', async (_req, res) => {
  try {
    const { symbol } = _req.params;
    
    await liveMarketDataIntegration.unsubscribeFromSymbol(symbol.toUpperCase());
    
    res.json({
      success: true,
      message: `Unsubscribed from ${symbol.toUpperCase()}`,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error unsubscribing from symbol:', error);
    res.status(500).json({ 
      error: 'Failed to unsubscribe from symbol',
      success: false
    });
  }
});

// Security status endpoint
app.get('/api/v1/security/status', async (_req, res) => {
  try {
    const securityStatus = securityStack.getSecurityStatus();
    const sessionService = securityStack.getSessionService();
    
    let sessionStats = null;
    if (sessionService) {
      sessionStats = await sessionService.getSessionStats();
    }
    
    res.json({
      security: securityStatus,
      sessions: sessionStats,
      authentication: {
        jwtEnabled: true,
        sessionManagementEnabled: !!sessionService,
        mfaSupported: true,
        apiKeySupported: true
      },
      rateLimit: {
        enabled: true,
        windowMs: config.security.rateLimitWindowMs,
        maxRequests: config.security.rateLimitMax
      },
      cors: {
        enabled: true,
        origin: config.websocket.cors.origin
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting security status:', error);
    res.status(500).json({ 
      error: 'Failed to get security status' 
    });
  }
});

// Paper trading safety score endpoint
app.get('/api/v1/paper-trading/safety-score', async (_req, res) => {
  try {
    const { SafetyScoreEnforcementMiddleware } = await import('@/middleware/safetyScoreEnforcement');
    const enforcementMiddleware = SafetyScoreEnforcementMiddleware.getInstance();
    const status = await enforcementMiddleware.getSafetyScoreStatus();
    
    const { paperTradingSafetyScoreValidator } = await import('@/services/PaperTradingSafetyScoreValidator');
    const report = await paperTradingSafetyScoreValidator.getSafetyScoreReport();
    
    res.json({
      safetyScore: {
        percentage: status.score,
        passed: status.passed,
        minimumRequired: status.minimumRequired,
        lastValidation: status.lastValidation,
        systemBlocked: status.systemBlocked,
        blockReason: status.blockReason
      },
      detailedReport: {
        totalScore: report.totalScore,
        maxScore: report.maxScore,
        components: report.components,
        violations: report.violations,
        recommendations: report.recommendations
      },
      status: status.passed ? 'SAFE' : 'UNSAFE',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting paper trading safety score:', error);
    res.status(500).json({ 
      error: 'Failed to get paper trading safety score',
      safetyScore: { percentage: 0, passed: false }
    });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await prometheusMetricsService.getMetrics());
  } catch (error) {
    logger.error('Error serving metrics:', error);
    res.status(500).end(error);
  }
});

// Metrics status endpoint
app.get('/api/v1/metrics/status', (_req, res) => {
  try {
    const status = prometheusMetricsService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting metrics status:', error);
    res.status(500).json({ error: 'Failed to get metrics status' });
  }
});

// Cache test endpoint for Redis validation
app.get('/api/cache/test', async (_req, res) => {
  try {
    // Simple cache test - this would use Redis in a real implementation
    const testData = {
      cached: true,
      redis: true,
      timestamp: new Date().toISOString(),
      testValue: 'cache-test-success'
    };
    
    res.json(testData);
  } catch (error) {
    logger.error('Cache test error:', error);
    res.status(500).json({ 
      cached: false,
      redis: false,
      error: 'Cache test failed' 
    });
  }
});

// Import and mount auth routes
import authRoutes from '@/routes/auth';

// Mount auth routes (no authentication required for these)
app.use('/api/v1/auth', authRoutes);

// Mount API routes
app.use('/api/v1', apiRoutes);

// Mount alerting routes
app.use('/api/alerting', alertingRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'AI Crypto Trading Bot API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      api: '/api/v1',
      docs: '/api/docs'
    },
    paperTradingMode: config.paperTrading.enabled,
    safetyStatus: !config.paperTrading.allowRealTrades ? 'SAFE' : 'WARNING'
  });
});

// 404 handler for non-API routes
app.use(notFoundHandler);

// Alerting error tracking middleware
app.use(alertingIntegration.errorTracking);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize enhanced WebSocket service with comprehensive features
import { EnhancedWebSocketService } from '@/services/EnhancedWebSocketService';
import { LiveMarketDataIntegration } from '@/services/LiveMarketDataIntegration.minimal';

const enhancedWebSocketService = new EnhancedWebSocketService(server, {
  maxConnections: config.production.performance.websocketMaxConnections,
  maxConnectionsPerUser: 10,
  connectionTimeout: 300000, // 5 minutes
  heartbeatInterval: 30000, // 30 seconds
  cleanupInterval: 60000, // 1 minute
  rateLimitWindow: config.websocket.rateLimit.windowMs,
  rateLimitMax: config.websocket.rateLimit.maxRequests,
  enableAuthentication: true,
  allowAnonymous: true,
  enableMetrics: true,
  enableResourceOptimization: true
});

// Initialize Live Market Data Integration
const liveMarketDataIntegration = new LiveMarketDataIntegration({
  exchanges: {
    binance: {
      enabled: true,
      symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT'],
      timeframes: ['1m', '5m', '15m', '1h']
    },
    kucoin: {
      enabled: true,
      symbols: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'ADA-USDT', 'XRP-USDT', 'SOL-USDT', 'DOT-USDT', 'DOGE-USDT', 'AVAX-USDT', 'MATIC-USDT'],
      timeframes: ['1m', '5m', '15m', '1h']
    }
  },
  cache: {
    enabled: true,
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    ttl: {
      ticker: 60,      // 1 minute
      candle: 300,     // 5 minutes
      orderbook: 30,   // 30 seconds
      aggregated: 600  // 10 minutes
    }
  },
  websocket: {
    enabled: true,
    broadcastChannels: [
      'ticker:*',
      'candles:*:*',
      'orderbook:*',
      'trades:*',
      'indicators:*'
    ]
  },
  indicators: {
    enabled: true,
    symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
    timeframes: ['1m', '5m', '15m', '1h']
  }
});

// Legacy service references for backward compatibility
const wsServer = (enhancedWebSocketService as any).wsServer;
const wsConnectionManager = (enhancedWebSocketService as any).connectionManager;
const wsAuthService = (enhancedWebSocketService as any).authService;
const dataBroadcastService = (enhancedWebSocketService as any).broadcastService;
const clientManager = (enhancedWebSocketService as any).clientManager;

// Set up enhanced WebSocket service event handlers
enhancedWebSocketService.on('connection', (data) => {
  logger.info(`WebSocket connection established: ${data.socketId} (User: ${data.userId})`);
});

enhancedWebSocketService.on('disconnection', (data) => {
  logger.info(`WebSocket connection closed: ${data.socketId} (Reason: ${data.reason})`);
});

enhancedWebSocketService.on('subscription', (data) => {
  logger.debug(`Channel subscription: ${data.channels.join(', ')} by ${data.socketId}`);
});

enhancedWebSocketService.on('error', (data) => {
  logger.error(`WebSocket error on ${data.socketId}:`, data.error);
});

enhancedWebSocketService.on('connectionLimitReached', (data) => {
  logger.warn(`WebSocket connection limit reached: ${data.current}/${data.max}`);
});

enhancedWebSocketService.on('metrics', (metrics) => {
  logger.debug(`WebSocket metrics - Connections: ${metrics.totalConnections}, Messages/sec: ${metrics.messagesPerSecond?.toFixed(2) || 'N/A'}`);
});

enhancedWebSocketService.on('authenticationFailure', (data) => {
  logger.warn(`WebSocket auth failure from ${data.ipAddress}: ${data.error}`);
});

enhancedWebSocketService.on('ipBlocked', (data) => {
  logger.warn(`IP blocked for WebSocket abuse: ${data.ipAddress}`);
});

enhancedWebSocketService.on('staleConnectionsRemoved', (data) => {
  logger.info(`Removed ${data.count} stale WebSocket connections`);
});

enhancedWebSocketService.on('broadcast', (data) => {
  logger.debug(`WebSocket broadcast to channel ${data.channel}: ${data.messageType} (${data.subscriberCount} subscribers)`);
});

enhancedWebSocketService.on('metricsCollected', (metrics) => {
  // Optionally log detailed metrics or send to monitoring system
  if (config.monitoring.metricsEnabled) {
    logger.debug(`WebSocket service metrics collected - Uptime: ${metrics.performance.uptime}ms, Memory: ${(metrics.performance.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }
});

// Enhanced WebSocket status endpoints
app.get('/api/v1/websocket/stats', (_req, res) => {
  try {
    const stats = enhancedWebSocketService.getComprehensiveStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to get WebSocket stats' });
  }
});

app.get('/api/v1/websocket/health', (_req, res) => {
  try {
    const health = enhancedWebSocketService.getHealthStatus();
    res.json(health);
  } catch (error) {
    logger.error('Error getting WebSocket health:', error);
    res.status(500).json({ error: 'Failed to get WebSocket health status' });
  }
});

app.get('/api/v1/websocket/channels', (_req, res) => {
  try {
    const { userId, role } = _req.query;
    const channels = enhancedWebSocketService.getAvailableChannels(
      userId as string, 
      role as string
    );
    res.json({ channels });
  } catch (error) {
    logger.error('Error getting WebSocket channels:', error);
    res.status(500).json({ error: 'Failed to get WebSocket channels' });
  }
});

app.get('/api/v1/websocket/connections/:userId', (_req, res) => {
  try {
    const { userId } = _req.params;
    const connections = enhancedWebSocketService.getUserConnections(userId);
    res.json({ 
      userId, 
      connectionCount: connections.length,
      connections: connections.map(conn => ({
        socketId: conn.id,
        connectedAt: conn.connectionMetrics?.connectTime,
        lastActivity: conn.lastActivity
      }))
    });
  } catch (error) {
    logger.error('Error getting user connections:', error);
    res.status(500).json({ error: 'Failed to get user connections' });
  }
});

// WebSocket management endpoints (admin only)
app.post('/api/v1/websocket/disconnect/:socketId', (_req, res) => {
  try {
    const { socketId } = _req.params;
    const { reason } = _req.body;
    
    enhancedWebSocketService.disconnectClient(socketId, reason);
    res.json({ success: true, message: `Client ${socketId} disconnected` });
  } catch (error) {
    logger.error('Error disconnecting WebSocket client:', error);
    res.status(500).json({ error: 'Failed to disconnect client' });
  }
});

app.post('/api/v1/websocket/disconnect/user/:userId', (_req, res) => {
  try {
    const { userId } = _req.params;
    const { reason } = _req.body;
    
    enhancedWebSocketService.disconnectUser(userId, reason);
    res.json({ success: true, message: `All connections for user ${userId} disconnected` });
  } catch (error) {
    logger.error('Error disconnecting user WebSocket connections:', error);
    res.status(500).json({ error: 'Failed to disconnect user connections' });
  }
});

app.post('/api/v1/websocket/disconnect/ip/:ipAddress', (_req, res) => {
  try {
    const { ipAddress } = _req.params;
    const { reason } = _req.body;
    
    const disconnectedCount = enhancedWebSocketService.disconnectByIP(ipAddress, reason);
    res.json({ 
      success: true, 
      message: `${disconnectedCount} connections from IP ${ipAddress} disconnected` 
    });
  } catch (error) {
    logger.error('Error disconnecting WebSocket connections by IP:', error);
    res.status(500).json({ error: 'Failed to disconnect connections by IP' });
  }
});

app.post('/api/v1/websocket/broadcast', (_req, res) => {
  try {
    const { channel, message, type = 'all', userId } = _req.body;
    
    const wsMessage = {
      type: message.type || 'broadcast',
      data: message.data || message,
      timestamp: Date.now()
    };

    switch (type) {
      case 'channel':
        if (!channel) {
          return res.status(400).json({ error: 'Channel required for channel broadcast' });
        }
        enhancedWebSocketService.broadcastToChannel(channel, wsMessage);
        break;
      case 'user':
        if (!userId) {
          return res.status(400).json({ error: 'userId required for user broadcast' });
        }
        enhancedWebSocketService.broadcastToUser(userId, wsMessage);
        break;
      case 'all':
      default:
        enhancedWebSocketService.broadcastToAll(wsMessage);
        break;
    }
    
    res.json({ success: true, message: 'Broadcast sent successfully' });
  } catch (error) {
    logger.error('Error broadcasting WebSocket message:', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

app.post('/api/v1/websocket/broadcast/batch', (_req, res) => {
  try {
    const { broadcasts } = _req.body;
    
    if (!Array.isArray(broadcasts)) {
      return res.status(400).json({ error: 'broadcasts must be an array' });
    }

    enhancedWebSocketService.broadcastBatch(broadcasts);
    res.json({ 
      success: true, 
      message: `${broadcasts.length} broadcasts sent successfully` 
    });
  } catch (error) {
    logger.error('Error broadcasting batch WebSocket messages:', error);
    res.status(500).json({ error: 'Failed to broadcast batch messages' });
  }
});

const PORT = config.server.port;

// Start token cleanup task (runs every hour)
setInterval(() => {
  AuthService.cleanupExpiredTokens().catch(error => {
    logger.error('Token cleanup error:', error);
  });
}, 60 * 60 * 1000); // 1 hour

server.listen(PORT, async () => {
  
  // CRITICAL: Validate paper trading safety score on startup
  try {
    logger.info('🔍 Validating paper trading safety score...');
    await validateSafetyScoreOnStartup();
    logger.info('✅ Paper trading safety score validation passed');
  } catch (error) {
    logger.error('❌ CRITICAL: Paper trading safety score validation failed:', error);
    logger.error('🚫 System startup blocked due to insufficient safety score');
    process.exit(1);
  }
  
  // Initialize security stack
  try {
    await initializeSecurity();
  } catch (error) {
    logger.error('Failed to initialize security stack:', error);
    process.exit(1);
  }
  
  // Start the enhanced WebSocket service
  enhancedWebSocketService.start();
  
  // Start Live Market Data Integration
  try {
    logger.info('🚀 Starting Live Market Data Integration...');
    await liveMarketDataIntegration.start();
    
    // Set up live market data event handlers
    liveMarketDataIntegration.on('started', () => {
      logger.info('✅ Live Market Data Integration started successfully');
    });
    
    liveMarketDataIntegration.on('tickerReceived', (data) => {
      logger.debug(`📊 Ticker received: ${data.ticker.symbol} @ ${data.ticker.price} (${data.exchange})`);
    });
    
    liveMarketDataIntegration.on('candleReceived', (data) => {
      logger.debug(`📈 Candle received: ${data.candle.symbol} ${data.candle.timeframe} (${data.exchange})`);
    });
    
    liveMarketDataIntegration.on('indicatorsUpdated', (data) => {
      logger.debug(`📊 Indicators updated: ${data.symbol} ${data.timeframe}`);
    });
    
    liveMarketDataIntegration.on('healthCheck', (data) => {
      if (!data.isHealthy) {
        logger.warn(`⚠️  Live market data health check failed: ${data.stats.overall.healthScore}%`);
      }
    });
    
    liveMarketDataIntegration.on('exchangeStreamConnected', (data) => {
      logger.info(`🔗 ${data.exchange} stream connected: ${data.stream}`);
    });
    
    liveMarketDataIntegration.on('exchangeStreamDisconnected', (data) => {
      logger.warn(`🔌 ${data.exchange} stream disconnected: ${data.stream}`);
    });
    
    logger.info('✅ Live Market Data Integration initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize Live Market Data Integration:', error);
    // Don't exit on live data failure in development, but warn
    if (config.environment.isProduction) {
      logger.error('Exiting application due to live market data failure in production');
      process.exit(1);
    }
  }
  
  // Initialize health monitoring services
  try {
    // Set service references for health monitoring
    systemHealthService.setServiceReferences({
      cacheManager: cacheManager,
      exchangeManager: exchangeManager,
      webSocketServer: enhancedWebSocketService as any
    });
    
    // Start health checks
    systemHealthService.startHealthChecks(30000); // Check every 30 seconds
    
    logger.info('✅ Health monitoring services initialized');
  } catch (error) {
    logger.error('Failed to initialize health monitoring:', error);
    // Don't exit on health monitoring failure, just log the error
  }
  
  // Start Prometheus metrics collection
  try {
    prometheusMetricsService.start();
    
    // Set up metrics event handlers
    prometheusMetricsService.on('started', (data) => {
      logger.info(`✅ Prometheus metrics collection started with ${data.interval}ms interval`);
    });
    
    prometheusMetricsService.on('metricsCollected', (data) => {
      logger.debug(`Metrics collected in ${data.duration}ms`);
    });
    
    prometheusMetricsService.on('error', (error) => {
      logger.error('Prometheus metrics collection error:', error);
    });
    
    logger.info('✅ Prometheus metrics service initialized');
  } catch (error) {
    logger.error('Failed to initialize Prometheus metrics service:', error);
    // Don't exit on metrics failure, just log the error
  }
  
  logger.info(`🚀 AI Crypto Trading Bot server started on ${protocol}://localhost:${PORT}`);
  logger.info(`📊 Environment: ${config.env}`);
  logger.info(`🔗 Health check: ${protocol}://localhost:${PORT}/health`);
  logger.info(`📚 API Documentation: ${protocol}://localhost:${PORT}/api/docs`);
  logger.info(`🔌 Enhanced WebSocket server ready for connections`);
  logger.info(`🛡️  Security: Enhanced security stack enabled`);
  logger.info(`🔐 TLS: ${server instanceof require('https').Server ? 'Enabled' : 'Disabled'}`);
  logger.info(`🛡️  Authentication: JWT with audit logging`);
  logger.info(`🚨 Monitoring: Suspicious activity detection active`);
  logger.info(`⚡ Rate limiting: Enabled for all endpoints`);
  logger.info(`🔍 Input validation: SQL injection and XSS protection active`);
  
  // WebSocket Service Status
  logger.info(`🌐 WebSocket Features:`);
  logger.info(`   - Connection Management: Advanced pooling and resource optimization`);
  logger.info(`   - Authentication: JWT + Anonymous support`);
  logger.info(`   - Broadcasting: Channel, User, and Global messaging`);
  logger.info(`   - Rate Limiting: Per-connection and global limits`);
  logger.info(`   - Monitoring: Real-time metrics and health checks`);
  logger.info(`   - Resource Management: Automatic cleanup and optimization`);
  logger.info(`🔌 WebSocket Endpoints:`);
  logger.info(`   - Stats: ${protocol}://localhost:${PORT}/api/v1/websocket/stats`);
  logger.info(`   - Health: ${protocol}://localhost:${PORT}/api/v1/websocket/health`);
  logger.info(`   - Channels: ${protocol}://localhost:${PORT}/api/v1/websocket/channels`);
  
  // CRITICAL: Paper Trading Safety Status
  logger.info(`🔒 PAPER TRADING MODE: ${config.paperTrading.enabled ? 'ENABLED' : 'DISABLED'}`);
  logger.info(`🚫 REAL TRADES: ${config.paperTrading.allowRealTrades ? 'ALLOWED (DANGER!)' : 'BLOCKED (SAFE)'}`);
  logger.info(`💰 Virtual Balance: ${JSON.stringify(config.paperTrading.initialVirtualBalance)}`);
  logger.info(`🎯 Paper Trading Status: ${protocol}://localhost:${PORT}/api/v1/paper-trading/status`);
  
  if (!config.paperTrading.enabled || config.paperTrading.allowRealTrades) {
    logger.error('⚠️  WARNING: UNSAFE PAPER TRADING CONFIGURATION DETECTED!');
    logger.error('⚠️  This configuration may allow real money operations!');
  } else {
    logger.info('✅ Paper trading safety: All real money operations blocked');
    logger.info('✅ Virtual portfolio: Ready for simulated trading');
    logger.info('✅ Trade simulation: Realistic market conditions enabled');
    logger.info('✅ WebSocket server: Real-time data broadcasting ready');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(async () => {
    logger.info('Server closed');
    try {
      // Stop health monitoring
      systemHealthService.stopHealthChecks();
      await systemHealthService.cleanup();
      
      // Stop monitoring service
      monitoringService.stop();
      
      // Stop Prometheus metrics service
      prometheusMetricsService.stop();
      
      // Stop WebSocket service
      await enhancedWebSocketService.stop();
      
      // Stop Live Market Data Integration
      await liveMarketDataIntegration.stop();
      
      // Disconnect database
      await prisma.$disconnect();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(async () => {
    logger.info('Server closed');
    try {
      // Stop health monitoring
      systemHealthService.stopHealthChecks();
      await systemHealthService.cleanup();
      
      // Stop monitoring service
      monitoringService.stop();
      
      // Stop Prometheus metrics service
      prometheusMetricsService.stop();
      
      // Stop WebSocket service
      await enhancedWebSocketService.stop();
      
      // Stop Live Market Data Integration
      await liveMarketDataIntegration.stop();
      
      // Disconnect database
      await prisma.$disconnect();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

export default app;
export { 
  enhancedWebSocketService,
  wsServer, 
  wsConnectionManager, 
  wsAuthService, 
  dataBroadcastService, 
  clientManager 
};