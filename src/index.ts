import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/config/config';
import { swaggerSpec } from '@/config/swagger';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { register } from '@/utils/metrics';

// Enhanced security middleware
import { 
  securityHeaders, 
  corsOptions, 
  forceHTTPS, 
  validateRequest,
  requestId,
  responseTime,
  validateContent,
  websocketSecurity,
  securityMonitoring
} from '@/middleware/security';
import { comprehensiveValidation } from '@/middleware/inputValidation';

import { WebSocketServer } from '@/services/WebSocketServer';
import { DataBroadcastService } from '@/services/DataBroadcastService';
import { WebSocketClientManager } from '@/services/WebSocketClientManager';
import { AuthService } from '@/services/AuthService';
import { AuditLogService } from '@/services/AuditLogService';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { NotificationService } from '@/services/NotificationService';
import { PrismaClient } from '@prisma/client';
import apiRoutes from '@/routes';

const app = express();

// Initialize database and security services
const prisma = new PrismaClient();
const auditLogService = new AuditLogService(prisma);
const notificationService = new NotificationService();
const securityMonitoringService = new SecurityMonitoringService(
  prisma, 
  auditLogService, 
  notificationService
);

// Create HTTP server for development
const server = createServer(app);

// Basic middleware stack
app.use(corsOptions);

app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// Mount API routes
app.use('/api/v1', apiRoutes);

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
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize WebSocket services with security
const wsServer = new WebSocketServer(server, {
  cors: corsOptions,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  }
});

// Add WebSocket security middleware
wsServer.use(websocketSecurity.validateConnection);
wsServer.use(websocketSecurity.validateMessage);

const dataBroadcastService = new DataBroadcastService(wsServer);
const clientManager = new WebSocketClientManager();

// WebSocket status endpoint
app.get('/api/v1/websocket/stats', (_req, res) => {
  try {
    const stats = {
      server: wsServer.getServerStats(),
      clients: clientManager.getClientStats(),
      broadcast: dataBroadcastService.getStats()
    };
    res.json(stats);
  } catch (error) {
    logger.error('Error getting WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to get WebSocket stats' });
  }
});

const PORT = config.server.port;

// Start token cleanup task (runs every hour)
setInterval(() => {
  AuthService.cleanupExpiredTokens().catch(error => {
    logger.error('Token cleanup error:', error);
  });
}, 60 * 60 * 1000); // 1 hour

server.listen(PORT, () => {
  const protocol = server instanceof require('https').Server ? 'https' : 'http';
  logger.info(`🚀 AI Crypto Trading Bot server started on ${protocol}://localhost:${PORT}`);
  logger.info(`📊 Environment: ${config.env}`);
  logger.info(`🔗 Health check: ${protocol}://localhost:${PORT}/health`);
  logger.info(`📚 API Documentation: ${protocol}://localhost:${PORT}/api/docs`);
  logger.info(`🔌 WebSocket server ready for connections`);
  logger.info(`🛡️  Security: Enhanced security stack enabled`);
  logger.info(`🔐 TLS: ${server instanceof require('https').Server ? 'Enabled' : 'Disabled'}`);
  logger.info(`🛡️  Authentication: JWT with audit logging`);
  logger.info(`🚨 Monitoring: Suspicious activity detection active`);
  logger.info(`⚡ Rate limiting: Enabled for all endpoints`);
  logger.info(`🔍 Input validation: SQL injection and XSS protection active`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    clientManager.shutdown();
    dataBroadcastService.cleanup();
    prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    clientManager.shutdown();
    dataBroadcastService.cleanup();
    prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
export { wsServer, dataBroadcastService, clientManager };