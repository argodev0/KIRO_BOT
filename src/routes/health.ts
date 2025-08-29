import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import { MonitoringService } from '../services/MonitoringService';
import { logger } from '../utils/logger';

const router = Router();
const healthController = new HealthController();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Simple health check endpoint for load balancers
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
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
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', healthController.basicHealth);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Comprehensive health check with system metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health information
 *       503:
 *         description: Service is unhealthy
 */
router.get('/detailed', healthController.detailedHealth);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Kubernetes readiness probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready to serve traffic
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', healthController.readiness);

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Kubernetes liveness probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 *       503:
 *         description: Service should be restarted
 */
router.get('/live', healthController.liveness);

/**
 * @swagger
 * /health/startup:
 *   get:
 *     summary: Startup probe
 *     description: Kubernetes startup probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service has started successfully
 *       503:
 *         description: Service is still starting
 */
router.get('/startup', healthController.startup);

/**
 * @swagger
 * /health/deep:
 *   get:
 *     summary: Deep health check
 *     description: Comprehensive system validation
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All deep health checks passed
 *       503:
 *         description: One or more deep health checks failed
 */
router.get('/deep', healthController.deepHealth);

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Prometheus metrics endpoint for monitoring
 *     tags: [Health, Monitoring]
 *     produces:
 *       - text/plain
 *     responses:
 *       200:
 *         description: Prometheus metrics in text format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', async (req, res) => {
  try {
    const monitoring = MonitoringService.getInstance();
    const metrics = await monitoring.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).send('Error getting metrics');
  }
});

/**
 * @swagger
 * /health/services:
 *   get:
 *     summary: Service status
 *     description: Get status of all monitored services
 *     tags: [Health, Monitoring]
 *     responses:
 *       200:
 *         description: Service statuses
 */
router.get('/services', healthController.serviceStatus);

/**
 * @swagger
 * /health/system:
 *   get:
 *     summary: Comprehensive system health
 *     description: Detailed health check for all system components
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Comprehensive system health report
 *       503:
 *         description: System health issues detected
 */
router.get('/system', healthController.systemHealth);

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database health check
 *     description: Check database connectivity and health
 *     tags: [Health, Database]
 *     responses:
 *       200:
 *         description: Database is healthy
 *       503:
 *         description: Database health issues
 */
router.get('/database', healthController.databaseHealth);

/**
 * @swagger
 * /health/redis:
 *   get:
 *     summary: Redis health check
 *     description: Check Redis connectivity and health
 *     tags: [Health, Cache]
 *     responses:
 *       200:
 *         description: Redis is healthy
 *       503:
 *         description: Redis health issues
 */
router.get('/redis', healthController.redisHealth);

/**
 * @swagger
 * /health/exchanges:
 *   get:
 *     summary: Exchange APIs health check
 *     description: Check exchange API connectivity and health
 *     tags: [Health, Exchanges]
 *     responses:
 *       200:
 *         description: Exchange APIs are healthy
 *       503:
 *         description: Exchange API health issues
 */
router.get('/exchanges', healthController.exchangesHealth);

/**
 * @swagger
 * /health/websocket:
 *   get:
 *     summary: WebSocket health check
 *     description: Check WebSocket server health
 *     tags: [Health, WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket server is healthy
 *       503:
 *         description: WebSocket server health issues
 */
router.get('/websocket', healthController.websocketHealth);

/**
 * @swagger
 * /health/paper-trading-safety:
 *   get:
 *     summary: Paper trading safety check
 *     description: Validate paper trading safety configuration
 *     tags: [Health, Safety]
 *     responses:
 *       200:
 *         description: Paper trading safety is configured correctly
 *       503:
 *         description: Paper trading safety issues detected
 */
router.get('/paper-trading-safety', healthController.paperTradingSafety);

/**
 * @swagger
 * /health/all-services:
 *   get:
 *     summary: All services health check
 *     description: Check health status of all monitored services
 *     tags: [Health, Services]
 *     responses:
 *       200:
 *         description: All services health status
 *       503:
 *         description: One or more services are unhealthy
 */
router.get('/all-services', healthController.allServicesHealth);

/**
 * @swagger
 * /health/infrastructure:
 *   get:
 *     summary: Infrastructure health check
 *     description: Check health of core infrastructure components (database, redis, filesystem)
 *     tags: [Health, Infrastructure]
 *     responses:
 *       200:
 *         description: Infrastructure components are healthy
 *       503:
 *         description: Infrastructure health issues detected
 */
router.get('/infrastructure', healthController.infrastructureHealth);

/**
 * @swagger
 * /health/external-services:
 *   get:
 *     summary: External services health check
 *     description: Check connectivity to external services (exchanges, APIs)
 *     tags: [Health, External]
 *     responses:
 *       200:
 *         description: External services are accessible
 *       503:
 *         description: External service connectivity issues
 */
router.get('/external-services', healthController.externalServicesHealth);

/**
 * @swagger
 * /health/application:
 *   get:
 *     summary: Application health check
 *     description: Check application-specific health metrics (memory, CPU, WebSocket, paper trading)
 *     tags: [Health, Application]
 *     responses:
 *       200:
 *         description: Application is healthy
 *       503:
 *         description: Application health issues detected
 */
router.get('/application', healthController.applicationHealth);

export default router;