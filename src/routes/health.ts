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
router.get('/services', async (req, res) => {
  try {
    const monitoring = MonitoringService.getInstance();
    const services = monitoring.getServiceStatuses();
    
    res.json({
      timestamp: new Date().toISOString(),
      services: services
    });
  } catch (error) {
    logger.error('Error getting service statuses:', error);
    res.status(500).json({ error: 'Failed to get service statuses' });
  }
});

export default router;